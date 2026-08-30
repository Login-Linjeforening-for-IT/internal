import type { FastifyInstance } from 'fastify'
import config from '#config'
import { collectDockerLogsOverview } from '#utils/containers/logs/collectDockerLogsOverview.ts'
import { discordAlert } from 'utilbee/utils'
import { buildLogsDeepLink } from '#utils/containers/logs/buildLogsDeepLink.ts'
import escapeCodeBlock from '#utils/containers/logs/escapeCodeBlock.ts'
import truncate from '#utils/containers/logs/truncate.ts'
import { ensureInternalSchema, query } from '#db'
import { createHash } from 'crypto'

function incidentKey(source: { service: string, name: string }, entry: LogEntry) {
    return createHash('sha1')
        .update([source.service, source.name, entry.level, entry.message.trim()].join('::'))
        .digest('hex')
}

export default async function logAlertScheduler(fastify: FastifyInstance) {
    if (!config.logs.alerts.enabled || !config.logs.alerts.webhook) {
        fastify.log.info('Log alert scheduler disabled.')
        return
    }

    try { Bun.cron.parse(config.logs.alerts.schedule) } catch {
        fastify.log.error(`Invalid log alert schedule: ${config.logs.alerts.schedule}. Log alerts not started.`)
        return
    }

    fastify.log.info(`Log alert scheduler started. Schedule: '${config.logs.alerts.schedule}'`)

    let primed = false
    let running = false

    Bun.cron(config.logs.alerts.schedule, async () => {
        if (running) return
        running = true
        try {
            await ensureInternalSchema()
            await query('DELETE FROM log_alert_incidents WHERE alerted_at < now() - interval \'24 hours\'')
            const { rows } = await query<{ incident_key: string }>(
                'SELECT incident_key FROM log_alert_incidents WHERE alerted_at >= now() - interval \'24 hours\''
            )
            const seenIncidents = new Set(rows.map(row => row.incident_key))
            const overview = await collectDockerLogsOverview({ level: 'error', tail: 200 })
            const pending = overview.containers.flatMap(source =>
                source.entries.map(entry => ({ entry, source }))
            )

            if (!primed) {
                pending.forEach(({ entry, source }) => {
                    seenIncidents.add(incidentKey(source, entry))
                })
                primed = true
                return
            }

            for (const item of pending) {
                const key = incidentKey(item.source, item.entry)
                if (seenIncidents.has(key)) {
                    continue
                }

                const logDetails = truncate(item.entry.raw || item.entry.message)
                const deepLink = buildLogsDeepLink(item.source.id, item.entry.fingerprint)

                let sent = false
                for (let attempt = 0; attempt < 3 && !sent; attempt++) {
                    try {
                        await discordAlert({
                            webhookURL: config.logs.alerts.webhook!,
                            threadId: config.logs.alerts.threadId,
                            title: `${item.source.name} reported an error`,
                            url: deepLink,
                            color: config.login.color,
                            description: `\`\`\`log\n${escapeCodeBlock(logDetails)}\n\`\`\``,
                            fields: [
                                { name: 'Server', value: overview.server, inline: true },
                                { name: 'Service', value: item.source.service, inline: true },
                                { name: 'Source', value: item.source.name, inline: true },
                                { name: 'Status', value: item.source.status, inline: true },
                                { name: 'Level', value: item.entry.level, inline: true },
                                { name: 'Link', value: deepLink, inline: false },
                            ],
                            footer: `Fingerprint ${item.entry.fingerprint}`,
                            timestamp: item.entry.timestamp || overview.checkedAt,
                        })
                        sent = true
                    } catch (error) {
                        const retryAfter = Number(/retry_after[^0-9]*([0-9.]+)/i.exec(String(error))?.[1] || 0)
                        if (!retryAfter || attempt === 2) throw error
                        await new Promise(resolve => setTimeout(resolve, Math.ceil(retryAfter * 1000) + 100))
                    }
                }
                await query(
                    'INSERT INTO log_alert_incidents (incident_key) VALUES ($1) ON CONFLICT (incident_key) DO NOTHING',
                    [key]
                )
                seenIncidents.add(key)
            }
        } catch (error) {
            fastify.log.error(error, 'Scheduled log alert dispatch failed.')
        } finally {
            running = false
        }
    })
}

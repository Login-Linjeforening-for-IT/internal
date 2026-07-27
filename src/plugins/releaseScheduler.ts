import type { FastifyInstance } from 'fastify'
import config from '#config'

type Feed = { name: string, url: string, color: number, repoUrl: string, avatarUrl: string }

async function fetchLatestRelease(feed: Feed): Promise<{ id: string, title: string, link: string } | null> {
    const res = await fetch(feed.url, { headers: { Accept: 'application/atom+xml' } })
    if (!res.ok) throw new Error(`Failed to fetch ${feed.url}: ${res.status}`)
    const xml = await res.text()

    const idMatch = xml.match(/<entry>[\s\S]*?<id>(.*?)<\/id>/)
    const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/)
    const linkMatch = xml.match(/<entry>[\s\S]*?<link[^>]+href="([^"]+)"/)

    if (!idMatch || !titleMatch) return null
    return {
        id: idMatch[1].trim(),
        title: titleMatch[1].trim(),
        link: linkMatch?.[1].trim() ?? feed.url,
    }
}

async function sendReleaseAlert(feed: Feed, release: { title: string, link: string }) {
    const webhookUrl = new URL(config.releases.webhookUrl!)
    if (config.releases.threadId) webhookUrl.searchParams.set('thread_id', config.releases.threadId)

    const res = await fetch(webhookUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [{
                author: {
                    name: feed.name,
                    url: feed.repoUrl,
                    icon_url: feed.avatarUrl,
                },
                title: `${release.title} released 🐝`,
                url: release.link,
                color: feed.color,
                footer: {
                    text: 'GitHub Releases',
                    icon_url: 'https://github.githubassets.com/favicons/favicon.png',
                },
                timestamp: new Date().toISOString(),
            }],
        }),
    })

    if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`)
}

export default async function releaseScheduler(fastify: FastifyInstance) {
    if (!config.releases.webhookUrl) {
        fastify.log.info('Release scheduler disabled — no webhook URL configured.')
        return
    }

    try { Bun.cron.parse(config.releases.schedule) } catch {
        fastify.log.error(`Invalid release schedule: ${config.releases.schedule}. Release scheduler not started.`)
        return
    }

    fastify.log.info(`Release scheduler started. Schedule: '${config.releases.schedule}'`)

    const lastSeen = new Map<string, string>()
    let primed = false

    Bun.cron(config.releases.schedule, async () => {
        for (const feed of config.releases.feeds) {
            try {
                const latest = await fetchLatestRelease(feed)
                if (!latest) continue

                if (!primed) {
                    lastSeen.set(feed.url, latest.id)
                    continue
                }

                if (lastSeen.get(feed.url) === latest.id) continue

                lastSeen.set(feed.url, latest.id)
                await sendReleaseAlert(feed, latest)
            } catch (err) {
                fastify.log.error(err, `Release check failed for ${feed.name}`)
            }
        }

        if (!primed) {
            primed = true
            fastify.log.info('Release scheduler primed.')
        }
    })
}

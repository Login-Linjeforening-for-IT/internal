import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { parse } from 'dotenv'
import config from '#config'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { CronExpressionParser } from 'cron-parser'
import { formatSize } from '#utils/format.ts'

const execAsync = promisify(exec)

export default async function getBackupStats(_: FastifyRequest, res: FastifyReply) {
    try {
        const format = '{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.working_dir"}}'
        const { stdout } = await execAsync(`docker ps -a --format '${format}'`)

        const nextBackup = (() => {
            try {
                return CronExpressionParser.parse(config.BACKUP_SCHEDULE).next().toISOString()
            } catch { return 'Invalid schedule' }
        })()

        const containers = await Promise.all(stdout.split('\n').filter(l => l.toLowerCase().includes('postgres')).map(async (line) => {
            const [id, name, status, , project, workingDir] = line.split('|')
            const info = { id, name, status, lastBackup: null as string | null, nextBackup, totalStorage: '0 B', dbSize: 'Unknown' }

            if (!project || !workingDir) return { ...info, dbSize: 'Missing labels' }

            try {
                const env = parse(await fs.readFile(path.join(workingDir, '.env'), 'utf-8').catch(() => ''))
                const { DB, DB_USER, DB_PASSWORD } = env

                if (!DB || !DB_USER || !DB_PASSWORD) info.dbSize = 'Missing env vars'
                else if (!status.startsWith('Up')) info.dbSize = 'Container not running'

                const backupDir = path.join(config.BACKUP_PATH, project)
                const [dbSize, stats] = await Promise.all([
                    info.dbSize === 'Unknown'
                        ? execAsync(
                            `docker exec -e PGPASSWORD="${DB_PASSWORD}" ${id} psql -U "${DB_USER}" -d "${DB}" -t -c "SELECT pg_database_size('${DB}');"`
                        ).then(r => r.stdout.trim()).catch(() => 'Error')
                        : Promise.resolve(info.dbSize),
                    fs.readdir(backupDir).then(async files => {
                        const s = await Promise.all(files.map(f => fs.stat(path.join(backupDir, f)).catch(() => null)))
                        return s.reduce((a, v) => v ? { size: a.size + v.size, time: Math.max(a.time, v.mtimeMs) } : a, { size: 0, time: 0 })
                    }).catch(() => ({ size: 0, time: 0 }))
                ])

                return {
                    ...info,
                    dbSize: isNaN(Number(dbSize)) ? dbSize : formatSize(Number(dbSize)),
                    totalStorage: formatSize(stats.size),
                    lastBackup: stats.time ? new Date(stats.time).toISOString() : null
                }
            } catch {
                return { ...info, dbSize: 'Error' }
            }
        }))

        res.send(containers)
    } catch (e: any) {
        res.status(500).send({ error: e.message })
    }
}

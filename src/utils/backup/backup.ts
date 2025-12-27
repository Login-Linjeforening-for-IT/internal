import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import config from '#config'
import getPostgresContainers from '#utils/backup/containers.ts'
import { getBackupDir, getContainerEnv } from '#utils/backup/utils.ts'

const execAsync = promisify(exec)

export async function runBackup() {
    try {
        const containers = await getPostgresContainers({ all: false })
        const projects = new Set<string>()

        await Promise.all(containers.map(async (container) => {
            const { id, name, project, workingDir } = container
            
            if (!project || !workingDir) return console.error(`\tMissing labels for ${name}`)

            try {
                const { DB, DB_USER, DB_PASSWORD } = await getContainerEnv(workingDir)
                if (!DB || !DB_USER || !DB_PASSWORD) throw new Error('Missing env vars')

                projects.add(project)
                const dir = getBackupDir(project)
                await fs.mkdir(dir, { recursive: true })

                const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).replace(/\D/g, '')
                const file = path.join(dir, `${DB}_${stamp}.sql`)
                await execAsync(`docker exec -e PGPASSWORD="${DB_PASSWORD}" ${id} pg_dump -c -U "${DB_USER}" "${DB}" > "${file}"`)

                if ((await fs.stat(file)).size === 0) {
                    await fs.unlink(file).catch(() => { })
                    throw new Error('Empty backup')
                }
                console.log(`\tSaved: ${file}`)
            } catch (e: any) {
                console.error(`\tFailed ${name}:`, e.message || e)
            }
        }))

        const limit = Date.now() - (Number(config.backup.retention) || 7) * 86400000
        for (const p of projects) {
            const dir = getBackupDir(p)
            const files = await fs.readdir(dir).catch(() => [])
            for (const f of files) {
                const fp = path.join(dir, f)
                if ((await fs.stat(fp)).mtimeMs < limit) await fs.unlink(fp).catch(() => { })
            }
        }
    } catch (e: any) {
        console.error('\tBackup process failed:', e.message || e)
    }
}

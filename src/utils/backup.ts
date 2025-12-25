import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { parse } from 'dotenv'
import config from '#config'

const execAsync = promisify(exec)

export async function runBackup() {
    try {
        const format = '{{.ID}}|{{.Names}}|{{.Image}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.working_dir"}}'
        const { stdout } = await execAsync(`docker ps --filter "label=com.docker.compose.project" --format '${format}'`)

        const projects = new Set<string>()
        await Promise.all(stdout.split('\n').filter(l => l.toLowerCase().includes('postgres')).map(async (line) => {
            const [id, name, , project, workingDir] = line.split('|')
            if (!workingDir || !project) return console.error(`\tMissing labels for ${name}`)

            try {
                const env = parse(await fs.readFile(path.join(workingDir, '.env'), 'utf-8').catch(() => ''))
                const { DB, DB_USER, DB_PASSWORD } = env
                if (!DB || !DB_USER || !DB_PASSWORD) throw new Error('Missing env vars')

                projects.add(project)
                const dir = path.join(config.backup.path, project)
                await fs.mkdir(dir, { recursive: true })

                const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).replace(/\D/g, '')
                const file = path.join(dir, `${DB}_${stamp}.sql`)
                await execAsync(`docker exec -e PGPASSWORD="${DB_PASSWORD}" ${id} pg_dump -U "${DB_USER}" "${DB}" > "${file}"`)

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
            const dir = path.join(config.backup.path, p)
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

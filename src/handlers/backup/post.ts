import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import config from '#config'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { getBackupDir, getContainerEnv } from '#utils/backup/utils.ts'
import getPostgresContainers from '#utils/backup/containers.ts'

const execAsync = promisify(exec)

type RestoreBackupProps = {
    id: string
    file: string
}

export default async function restoreBackup(req: FastifyRequest, res: FastifyReply) {
    const { id, file } = req.body as RestoreBackupProps

    if (!id || !file) {
        return res.status(400).send({ error: 'Missing id or file' })
    }

    try {
        const containers = await getPostgresContainers({ filterId: id })
        const container = containers[0]
        
        if (!container) {
            return res.status(404).send({ error: 'Container not found' })
        }

        const { id: containerId, name, status, project, workingDir } = container

        if (!project || !workingDir) {
            return res.status(400).send({ error: 'Container missing required labels' })
        }

        if (!status.startsWith('Up')) {
             return res.status(400).send({ error: 'Container is not running' })
        }

        const { DB, DB_USER, DB_PASSWORD } = await getContainerEnv(workingDir)

        if (!DB || !DB_USER || !DB_PASSWORD) {
            return res.status(400).send({ error: 'Missing database credentials in .env' })
        }

        const backupFilePath = path.join(getBackupDir(project), file)
        
        try {
            await fs.access(backupFilePath)
        } catch {
            return res.status(404).send({ error: 'Backup file not found' })
        }

        const backupDir = getBackupDir(project)
        await fs.mkdir(backupDir, { recursive: true })

        const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Oslo' }).replace(/\D/g, '')
        const newBackupFile = path.join(backupDir, `${DB}_${stamp}_pre_restore.sql`)

        await execAsync(`docker exec -e PGPASSWORD="${DB_PASSWORD}" ${containerId} pg_dump -c -U "${DB_USER}" "${DB}" > "${newBackupFile}"`)

        if ((await fs.stat(newBackupFile)).size === 0) {
            await fs.unlink(newBackupFile).catch(() => { })
            throw new Error('Failed to create pre-restore backup')
        }

        const command = `cat "${backupFilePath}" | docker exec -i -e PGPASSWORD="${DB_PASSWORD}" ${containerId} psql -U "${DB_USER}" -d "${DB}"`
        await execAsync(command)

        res.send({ message: 'Backup restored successfully' })
    } catch (e: any) {
        res.status(500).send({ error: e.message })
    }
}

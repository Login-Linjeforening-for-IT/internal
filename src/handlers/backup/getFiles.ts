import fs from 'fs/promises'
import path from 'path'
import config from '#config'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { formatSize } from '#utils/format.ts'

type GetBackupFilesProps = {
    service?: string
    date?: string
}

export default async function getBackupFiles(req: FastifyRequest, res: FastifyReply) {
    const { service, date } = req.query as GetBackupFilesProps
    try {
        const projects = await fs.readdir(config.BACKUP_PATH).catch(() => [])
        const files: { service: string, file: string, size: string, mtime: string }[] = []

        for (const project of projects) {
            if (service && project !== service) continue

            const projectDir = path.join(config.BACKUP_PATH, project)
            const stats = await fs.stat(projectDir).catch(() => null)
            if (!stats || !stats.isDirectory()) continue

            const projectFiles = await fs.readdir(projectDir).catch(() => [])
            for (const file of projectFiles) {
                if (date && !file.includes(date.replace(/-/g, ''))) continue

                const filePath = path.join(projectDir, file)
                const fileStat = await fs.stat(filePath).catch(() => null)
                if (fileStat && fileStat.isFile()) {
                    files.push({
                        service: project,
                        file,
                        size: formatSize(fileStat.size),
                        mtime: new Date(fileStat.mtimeMs).toISOString()
                    })
                }
            }
        }

        files.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())

        res.send(files)
    } catch (e: any) {
        res.status(500).send({ error: e.message })
    }
}

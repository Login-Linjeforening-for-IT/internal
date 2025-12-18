import type { FastifyReply, FastifyRequest } from 'fastify'
import fs from 'fs'
import path from 'path'

export default async function getFavicon(req: FastifyRequest, res: FastifyReply) {
    const faviconPath = path.join(process.cwd(), 'public', 'favicon.ico')
    const favicon = fs.readFileSync(faviconPath)
    res.type('image/x-icon').send(favicon)
}

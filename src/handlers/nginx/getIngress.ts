import type { FastifyReply, FastifyRequest } from "fastify"
import { readFile } from "fs/promises"
import path from "path"

export default async function getIngress(req: FastifyRequest, res: FastifyReply) {
    const { port } = req.params as { port: string }

    try {
        const filePath = path.join(__dirname, "/etc/nginx/sites-available/default")
        const data = await readFile(filePath, "utf8")
        const parsed = parseContent(data)
        return res.send({ parsed })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: (error as Error).message })
    }
}

function parseContent(text: string) {
    return text.split("\n").map(line => line.trim())
}

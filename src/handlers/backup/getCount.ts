import { exec } from 'child_process'
import { promisify } from 'util'
import type { FastifyReply, FastifyRequest } from 'fastify'

const execAsync = promisify(exec)

/**
 * Minimal endpoint to get database count
 * @param _ Fastify Request
 * @param res Fastify Reply
 * @returns Database count as { count: number }
 */
export default async function getDatabaseCount(_: FastifyRequest, res: FastifyReply) {
    try {
        const format = '{{.Image}}'
        const { stdout } = await execAsync(`docker ps -a --format '${format}'`)
        const containers = await Promise.all(stdout.split('\n')
            .filter(l => l.toLowerCase().includes('postgres'))
        )

        res.send({ count: containers.length })
    } catch (error) {
        res.status(500).send({ error: (error as Error).message })
    }
}

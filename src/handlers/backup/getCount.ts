import getPostgresContainers from '#utils/backup/containers.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Minimal endpoint to get database count
 * @param _ Fastify Request
 * @param res Fastify Reply
 * @returns Database count as { count: number }
 */
export default async function getDatabaseCount(_: FastifyRequest, res: FastifyReply) {
    try {
        const containers = await getPostgresContainers({ all: true })

        res.send({ count: containers.length })
    } catch (error) {
        res.status(500).send({ error: (error as Error).message })
    }
}

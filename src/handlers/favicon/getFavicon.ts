import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default async function getFavicon(
    this: FastifyInstance,
    req: FastifyRequest,
    res: FastifyReply
) {
    res.type('image/x-icon').send(this.favicon)
}

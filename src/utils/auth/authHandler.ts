import type { FastifyReply, FastifyRequest } from 'fastify'
import checkToken from './validateToken.ts'

export default async function authMiddleware(req: FastifyRequest, res: FastifyReply) {
    const tokenResult = await checkToken(req, res)
    if (!tokenResult.valid) {
        return res.status(401).send({ error: tokenResult.error })
    }
}

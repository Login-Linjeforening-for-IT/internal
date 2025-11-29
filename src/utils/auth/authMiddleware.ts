import type { FastifyReply, FastifyRequest } from 'fastify'
import validateToken from '#utils/auth/validateToken.ts'
import config from '#config'

declare module 'fastify' {
    interface FastifyRequest {
        user?: {
            id: string
            name: string
            email: string
            groups: string[]
        }
    }
}

export default async function preHandler(req: FastifyRequest, res: FastifyReply) {
    const tokenResult = await validateToken(req, res)
    if (!tokenResult.valid || !tokenResult.userInfo || !tokenResult.userInfo.sub) {
        return res.status(401).send({ error: tokenResult.error || 'Invalid user information' })
    }

    if(!tokenResult.userInfo.groups.includes(config.TEKKOM_GROUP)) {
        return res.status(403).send({ error: 'Insufficient permissions' })
    }

    req.user = {
        id: tokenResult.userInfo.sub,
        name: tokenResult.userInfo.name,
        email: tokenResult.userInfo.email,
        groups: tokenResult.userInfo.groups || []
    }
}
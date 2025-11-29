import type { FastifyReply, FastifyRequest } from 'fastify'
import config from '#config'

const { api_token } = config

type CheckTokenResponse = {
    valid: boolean
    userInfo?: {
        sub: string
        name: string
        email: string
    }
    error?: string
}

export default async function checkToken( req: FastifyRequest, res: FastifyReply ): Promise<CheckTokenResponse> {
    try {
        const authHeader = req.headers['authorization']
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).send({
                valid: false,
                error: 'Unauthorized'
            })
        }

        const token = authHeader.split(' ')[1]
        if (token !== api_token) {
            return res.status(401).send({
                valid: false,
                error: 'Unauthorized'
            })
        }

        return { valid: true }
    } catch (error) {
        res.log.error(error)
        return res.status(500).send({
            valid: false,
            error: 'Internal server error'
        })
    }
}

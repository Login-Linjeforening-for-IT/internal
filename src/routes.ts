import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import getIndex from './handlers/index/get.ts'
import getDockerContainers from './handlers/docker/get.ts'
import restartHandler from './handlers/docker/restart.ts'
import getServerStats from './handlers/stats/get.ts'
import restartServiceHandler from './handlers/docker/restartService.ts'

export default async function apiRoutes(fastify: FastifyInstance, _: FastifyPluginOptions) {
    // index
    fastify.get('/', getIndex)

    // docker
    fastify.get('/docker', getDockerContainers)
    fastify.get('/docker/restart/:id', restartHandler)
    fastify.get('/docker/restart/service/:id', restartServiceHandler)

    // stats
    fastify.get('/stats', getServerStats)
}

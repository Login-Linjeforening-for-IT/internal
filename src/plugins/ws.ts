import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import registerClient from '#utils/ws/registerClient.ts'
import removeClient from '#utils/ws/removeClient.ts'
import handleTerminalMessage from '#utils/ws/handleVMMessage.ts'
import type { RawData } from 'ws'
import followDockerStats from './followDocker.ts'
import followServerStats from './followStats.ts'

export default fp(async function wsShellPlugin(fastify: FastifyInstance) {
    fastify.register(async function (fastify) {
        fastify.get('/api/ws/docker/:id', { websocket: true }, (connection, req: FastifyRequest) => {
            const { id } = (req.params as { id: string })

            if (!id) {
                const rawData: RawData = Buffer.from(JSON.stringify({ type: 'update', content: `Missing id (${id}).` }))
                return connection.send(rawData)
            }

            registerClient(id, connection)
            followDockerStats(connection)

            connection.on('message', message => {
                handleTerminalMessage(id, connection, message)
            })

            connection.on('error', (error) => {
                console.error(`Connection failed for ${id}: ${error.message}`)
                if (connection.readyState === WebSocket.OPEN) {
                    try {
                        connection.send(JSON.stringify({ type: 'error', content: 'Connection failed', detail: error.message }))
                    } catch (error) {
                        console.error(`Send to client failed: ${error}`)
                    }
                }

                connection.close()
            })

            connection.on('close', () => {
                removeClient(id, connection)
            })
        })

        fastify.get('/api/ws/stats/:id', { websocket: true }, (connection, req: FastifyRequest) => {
            const { id } = req.params as { id: string }

            if (!id) {
                const rawData: RawData = Buffer.from(JSON.stringify({ type: 'update', content: `Missing id (${id}).` }))
                connection.send(rawData)
                return
            }

            registerClient(id, connection)
            const serverStats = followServerStats(connection)

            connection.on('message', message => {
                handleTerminalMessage(id, connection, message)
            })

            connection.on('error', (error) => {
                console.error(`Connection failed for ${id}: ${error.message}`)
                if (connection.readyState === connection.OPEN) {
                    try {
                        connection.send(JSON.stringify({ type: 'error', content: 'Connection failed', detail: error.message }))
                    } catch (err) {
                        console.error(`Send to client failed: ${err}`)
                    }
                }

                connection.close()
            })

            connection.on('close', () => {
                serverStats.stop()
                removeClient(id, connection)
            })
        })
    })
})

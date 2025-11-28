import { exec } from 'child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function getDockerContainers(_: FastifyRequest, res: FastifyReply) {
    try {
        const { stdout } = await execAsync(`docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}"`)
        
        const lines = stdout.split('\n').filter(Boolean)
        const containers = lines.map(line => {
            const [id, name, status] = line.split('|')
            return { id, name, status }
        })

        res.send({ status: containers.length > 0 ? 'available' : 'unavailable', count: containers.length, containers })
    } catch (err: any) {
        res.status(500).send({ error: err.message })
    }
}

import { exec } from 'child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function getDockerContainer(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }

    try {
        const { stdout } = await execAsync(
            `docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.RunningFor}}"`
        )

        const lines = stdout.split('\n').filter(Boolean)

        const containers = lines.map(line => {
            const [cid, name, status, uptime] = line.split('|')
            return { id: cid, name, status, uptime }
        })

        const container = containers.find(c => c.id.startsWith(id))
        if (!container) {
            return res.status(404).send({ error: "Container not found" })
        }

        const service = container.name.includes('_') ? container.name.split('_')[0] : container.name

        const relatedContainers = containers
            .filter(c => c.name.startsWith(service))
            .sort((a, b) => a.name.localeCompare(b.name))

        return res.send({
            service,
            container,
            related: relatedContainers
        })

    } catch (error) {
        return res.status(500).send({ error: (error as Error).message })
    }
}

import { exec } from 'child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default async function restartServiceHandler(req: FastifyRequest, res: FastifyReply) {
    const { id } = req.params as { id: string }
    if (!id) {
        return res.status(400).send({ error: 'No service provided' })
    }

    try {
        const { stdout, stderr } = await execAsync(
            `cd /home/ubuntu/${id} && rebuild -d`
        )

        if (stdout) {
            console.log(stdout)
        }

        if (stderr) {
            console.error(stderr)
        }

        return res.send({ ok: true, stdout, stderr })
    } catch (err: any) {
        console.error(`Error redeploying service ${id}:`, err.message)
        return res.status(500).send({ error: err.message })
    }
}

import { exec } from 'child_process'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

export default async function getDashboardStats(_: FastifyRequest, res: FastifyReply) {
    try {
        const { stdout } = await execAsync(`docker ps -a --format "{{.ID}}"`)
        const lines = stdout.split('\n').filter(Boolean)

        // CPU Load (1,5,15 min averages)
        const load = os.loadavg()

        // Memory usage
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const memPercent = ((usedMem / totalMem) * 100).toFixed(2)

        // Disk usage
        let diskUsage = 'N/A'
        try {
            const { stdout } = await execAsync('df -h /')
            const lines = stdout.split('\n')
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/)
                diskUsage = `${parts[2]} used of ${parts[1]} (${parts[4]})`
            }
        } catch { }

        // Processes
        const { stdout: psOut } = await execAsync('ps -e --no-headers | wc -l')
        const processes = parseInt(psOut.trim(), 10)

        res.send({
            containers: lines.length,
            load,
            ram: `${(usedMem / (1024 ** 3)).toFixed(1)}GB used of ${(totalMem / (1024 ** 3)).toFixed(1)}GB (${memPercent}%)`,
            disk: diskUsage,
            processes,
        })
    } catch (error) {
        return {
            ram: 'No RAM',
            processes: 0,
            disk: 'No Disk',
            load: 'No load',
            containers: 0
        }
    }
}

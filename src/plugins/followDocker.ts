import pty from 'node-pty'
import { WebSocket } from 'ws'

export default async function followDockerStats(connection: WebSocket) {
    const dockerStats = pty.spawn('docker', ['stats', '--no-stream=false', '--format',
        '{{.Container}}|{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}'
    ], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
    })

    let buffer = ''
    dockerStats.onData((data) => {
        buffer += data
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        const stats = lines.map(line => {
            const [containerId, name, cpu, memUsage, memPerc, netIO, blockIO, pids] = line.split('|')
            return {
                containerId,
                name,
                cpu,
                memUsage,
                memPerc,
                netIO,
                blockIO,
                pids: Number(pids)
            }
        })

        if (stats.length > 0) {
            try {
                connection.send(JSON.stringify({ type: 'docker_stats', containers: stats }))
            } catch (err) {
                console.warn('Failed to send docker stats:', err)
            }
        }
    })

    dockerStats.onExit(({ exitCode }) => {
        connection.send(JSON.stringify({
            type: 'docker_stats_exit',
            code: exitCode
        }))
    })

    connection.on('close', () => {
        dockerStats.kill()
    })

    return {
        kill: () => dockerStats.kill()
    }
}

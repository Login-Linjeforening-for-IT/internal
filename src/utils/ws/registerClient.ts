import { WebSocket } from 'ws'
import { WebSocket as WS } from 'ws'
import { terminalClients } from './handleVMMessage.ts'

export default function registerClient(id: string, socket: WebSocket) {
    if (!terminalClients.has(id)) {
        terminalClients.set(id, new Set())
    }

    terminalClients.get(id)!.add(socket)
    broadcastJoin(id)
}

function broadcastJoin(id: string) {
    const clients = terminalClients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'join',
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const client of clients) {
        if (client.readyState === WS.OPEN) {
            client.send(payload)
        }
    }
}

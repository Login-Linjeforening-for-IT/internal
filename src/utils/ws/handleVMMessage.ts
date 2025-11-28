import type { RawData } from 'ws'
import { WebSocket as WS } from 'ws'

export const terminalClients = new Map<string, Set<WS>>()
export const pendingUpdates = new Map<string, { content: string; timer: NodeJS.Timeout }>()

export default async function handleVMMessage(
    id: string,
    socket: WS,
    rawMessage: RawData,
) {
    try {
        const msg = JSON.parse(rawMessage.toString())
        if (msg.type !== ' ') {
            return
        }

        broadcastUpdate(id, socket, msg.content)
    } catch (error) {
        console.log(`Invalid WebSocket message: ${error}`)
    }
}

function broadcastUpdate(id: string, sender: WS, content: string) {
    const clients = terminalClients.get(id)
    if (!clients) {
        return
    }

    const payload = JSON.stringify({
        type: 'update',
        content,
        timestamp: new Date().toISOString(),
        participants: clients.size
    })

    for (const client of clients) {
        if (client !== sender && client.readyState === WS.OPEN) {
            client.send(payload)
        }
    }
}

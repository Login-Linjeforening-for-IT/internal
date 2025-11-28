import { WebSocket as WS } from 'ws'
import { terminalClients } from './handleVMMessage.ts'

export default function removeClient(id: string, socket: WS) {
    const clients = terminalClients.get(id)
    if (!clients) {
        return
    }

    clients.delete(socket)
    if (clients.size === 0) {
        terminalClients.delete(id)
    }
}

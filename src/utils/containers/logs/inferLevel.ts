import normalizeLevel from '#handlers/docker/normalizeLevel.ts'

const KNOWN_LEVELS = new Set(['error', 'warn', 'info', 'debug', 'trace'])

export default function inferLevel(message: string, fallback = '') {
    const plainMessage = message.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')

    if (/\b(warn|warning)\b/i.test(plainMessage)) {
        return 'warn'
    }

    if (/\b(info|notice)\b/i.test(plainMessage)) {
        return 'info'
    }

    const normalizedFallback = normalizeLevel(fallback)
    return normalizedFallback && KNOWN_LEVELS.has(normalizedFallback)
        ? normalizedFallback
        : null
}

import dotenv from 'dotenv'

dotenv.config()

const requiredEnvironmentVariables = [
    'API_TOKEN'
]

const missingVariables = requiredEnvironmentVariables
    .filter((key) => !process.env[key])
    .map((key) => `${key}: ${process.env[key] || 'undefined'}`)
    .join('\n')

if (missingVariables.length > 0) {
    throw new Error(`Missing essential environment variables:\n${missingVariables}`)
}

const env = Object.fromEntries(
    requiredEnvironmentVariables.map((key) => [key, process.env[key]])
)

const config = {
    api_token: env.API_TOKEN || ''
}

export default config

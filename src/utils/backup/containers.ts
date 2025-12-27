import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

type PostgresContainer = {
    id: string
    name: string
    image: string
    project: string
    workingDir: string
    status: string
}

export default async function getPostgresContainers(options: { all?: boolean, filterId?: string } = {}): Promise<PostgresContainer[]> {
    const format = '{{.ID}}|{{.Names}}|{{.Image}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.working_dir"}}|{{.Status}}'
    
    let cmd = 'docker ps'
    if (options.all || options.filterId) {
        cmd += ' -a'
    }
    
    if (options.filterId) {
        cmd += ` --filter "id=${options.filterId}"`
    } else if (!options.all) {
        cmd += ' --filter "label=com.docker.compose.project"'
    }

    cmd += ` --format '${format}'`

    const { stdout } = await execAsync(cmd)

    return stdout.split('\n')
        .filter(l => l.trim() !== '' && l.toLowerCase().includes('postgres'))
        .map(line => {
            const [id, name, image, project, workingDir, status] = line.split('|')
            return { id, name, image, project, workingDir, status }
        })
}
export function formatSize(b: number) {
    const i = b === 0 ? 0 : Math.floor(Math.log(b) / Math.log(1024))
    const size = b / Math.pow(1024, i)
    return `${Math.round(size)} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`
}

const config = {
    userinfo: 'https://authentik.login.no/application/o/userinfo/',
    tekkom: 'TekKom',
    backup: {
        path: '/home/dev/backups',
        schedule: '0 22 * * *',
        retention: 7
    }
}

export default config

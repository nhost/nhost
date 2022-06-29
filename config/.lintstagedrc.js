module.exports = {
  'packages/(docgen|hasura-auth-js|hasura-storage-js|nextjs|nhost-js|react|core|vue)/src/**/*.{js,ts,jsx,tsx}':
    ['pnpm docgen', 'git add docs'],
  '(nhost-cloud.yaml|**/nhost/config.yaml)': (filenames) => {
    console.log('filenames', filenames)
    return ['pnpm sync-versions', "git add ':(glob)**/nhost/config.yaml'"]
  }
}

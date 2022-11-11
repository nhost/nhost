module.exports = {
  '(packages|integrations)/(docgen|hasura-auth-js|hasura-storage-js|nextjs|nhost-js|react|core|vue)/src/**/*.{js,ts,jsx,tsx}':
    ['pnpm docgen', 'git add docs'],
  '(nhost-cloud.yaml|**/nhost/config.yaml)': () => [
    'pnpm sync-versions',
    "git add ':(glob)**/nhost/config.yaml'"
  ]
}

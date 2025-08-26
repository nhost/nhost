module.exports = {
  '(nhost-cloud.yaml|**/nhost/config.yaml)': () => [
    'pnpm sync-versions',
    "git add ':(glob)**/nhost/config.yaml'"
  ]
}

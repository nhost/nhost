/** @type {import('next').NextConfig} */
const nextConfig = {}

const pkg = require('./package.json')
// * Only required to make it work with the monorepo. Is not required otherwise
const withTM = require('next-transpile-modules')(
  // * All references to workspace packages are transpiled
  Object.entries(pkg.dependencies)
    .filter(([name, version]) => version.startsWith('workspace'))
    .map(([name]) => name)
)

module.exports = withTM(nextConfig)

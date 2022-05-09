/** @type {import('next').NextConfig} */
const nextConfig = {}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})

const pkg = require('./package.json')
// * Only required to make it work with the monorepo. Is not required otherwise
const withTM = require('next-transpile-modules')(
  // * All references to workspace packages are transpiled
  Object.entries(pkg.dependencies)
    .filter(([, version]) => version.startsWith('workspace'))
    .map(([name]) => name)
)

module.exports = withBundleAnalyzer(withTM(nextConfig))

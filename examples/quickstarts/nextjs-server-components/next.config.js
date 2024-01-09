/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['packages/nhost-js'],
  experimental: {
    serverActions: true
  }
}

module.exports = nextConfig

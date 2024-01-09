/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@nhost/nhost-js'],
  experimental: {
    serverActions: true
  }
}

module.exports = nextConfig

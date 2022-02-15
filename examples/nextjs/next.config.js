/** @type {import('next').NextConfig} */
// * Only required to make it work with the monorepo. Is not required otherwise
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // * Related to monorepo and the use of ws in @nhost/apollo
      config.resolve.fallback = { bufferutil: false, 'utf-8-validate': false }
    }
    return config
  }
}

const withTM = require('next-transpile-modules')(
  ['@nhost/core', '@nhost/react', '@nhost/react-apollo', '@nhost/apollo', '@nhost/nextjs'],
  {
    // resolveSymlinks: true
    // debug: true
  }
) // pass the modules you would like to see transpiled

module.exports = withTM(nextConfig)

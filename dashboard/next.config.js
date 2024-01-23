const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { version } = require('./package.json');


const cspHeader = `
    default-src 'self' 'https://staging.nhost.run';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' 'https://cdn.segment.com' 'https://js.stripe.com';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
`

module.exports = withBundleAnalyzer({
  reactStrictMode: true,
  swcMinify: false,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  publicRuntimeConfig: {
    version,
  },
  eslint: {
    dirs: ['src'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/signin',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/database/backups',
        destination: '/:workspaceSlug/:appSlug/backups',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/database/hasura',
        destination: '/:workspaceSlug/:appSlug/hasura',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/files',
        destination: '/:workspaceSlug/:appSlug/storage',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/database/browser',
        destination: '/:workspaceSlug/:appSlug/database/browser/default',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/users/logins',
        destination: '/:workspaceSlug/:appSlug/settings/sign-in-methods',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/users/logins/:providerId',
        destination:
          '/:workspaceSlug/:appSlug/settings/sign-in-methods/:providerId',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/users/smtp-settings',
        destination: '/:workspaceSlug/:appSlug/settings/smtp',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/users/roles',
        destination: '/:workspaceSlug/:appSlug/settings/roles-and-permissions',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/variables',
        destination: '/:workspaceSlug/:appSlug/settings/environment-variables',
        permanent: true,
      },
      {
        source: '/:workspaceSlug/:appSlug/users/:userId',
        destination: '/:workspaceSlug/:appSlug/users?userId=:userId',
        permanent: true,
      },
    ];
  },
});

const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { version } = require('./package.json');

function getCspHeader() {
  switch (process.env.CSP_MODE) {
    case 'disabled':
      return null;
    case 'custom':
      return process.env.CSP_HEADER || null;
    case 'nhost':
    default:
      return [
        "default-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run",
        "script-src 'self' 'unsafe-eval' cdn.segment.com js.stripe.com challenges.cloudflare.com googletagmanager.com",
        "connect-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run discord.com api.segment.io api.segment.com cdn.segment.com nhost.zendesk.com api.github.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: github.com avatars.githubusercontent.com s.gravatar.com *.nhost.run nhost.run",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src 'self' js.stripe.com challenges.cloudflare.com",
        "block-all-mixed-content",
        "upgrade-insecure-requests",
      ].join('; ') + ';';
  }
}

module.exports = withBundleAnalyzer({
  reactStrictMode: false,
  swcMinify: false,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
  },
  publicRuntimeConfig: {
    version,
  },
  eslint: {
    dirs: ['src'],
  },
  async headers() {
    const cspHeader = getCspHeader();

    if (!cspHeader) {
      return []; // No CSP headers
    }

    const cspHeader = getCspHeader();

    if (!cspHeader) {
      return []; // No CSP headers
    }

    return [
      {
        source: '/:path*',
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
            value: cspHeader,
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
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

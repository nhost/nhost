const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { version } = require('./package.json');

function getCspHeader() {
  // Default to strict mode for security (backward compatible with original hardcoded CSP)
  // Self-hosted deployments should explicitly set CSP_MODE=permissive
  const mode = process.env.CSP_MODE || 'strict';

  if (mode === 'permissive' || mode === 'disabled') {
    return null;
  }

  // Common CSP directives shared between strict and custom modes
  const commonDirectives = [
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' js.stripe.com challenges.cloudflare.com",
    "block-all-mixed-content",
    "upgrade-insecure-requests",
  ];

  if (mode === 'strict') {
    // Nhost Cloud policy - matches original hardcoded CSP
    return [
      "default-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run",
      ...commonDirectives,
      "connect-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run discord.com api.segment.io api.segment.com cdn.segment.com nhost.zendesk.com",
      "script-src 'self' 'unsafe-eval' cdn.segment.com js.stripe.com challenges.cloudflare.com googletagmanager.com",
      "img-src 'self' blob: data: github.com avatars.githubusercontent.com s.gravatar.com *.nhost.run nhost.run",
    ].join('; ');
  }

  if (mode === 'custom') {
    // User-defined domains for self-hosted deployments
    const defaultSrc = process.env.CSP_DEFAULT_SRC || "'self'";
    const connectSrc = process.env.CSP_CONNECT_SRC || "'self'";
    const scriptSrc = process.env.CSP_SCRIPT_SRC || "'self' 'unsafe-eval'";
    const imgSrc = process.env.CSP_IMG_SRC || "'self' data: blob:";

    return [
      `default-src ${defaultSrc}`,
      ...commonDirectives,
      `connect-src ${connectSrc}`,
      `script-src ${scriptSrc}`,
      `img-src ${imgSrc}`,
    ].join('; ');
  }

  return null;
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

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
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

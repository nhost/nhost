const path = require('node:path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

function getCspHeader() {
  switch (process.env.CSP_MODE) {
    case 'disabled':
      return null;
    case 'custom':
      return process.env.CSP_HEADER || null;
    default:
      return `${[
        "default-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run",
        "script-src 'self' 'unsafe-eval' cdn.segment.com js.stripe.com challenges.cloudflare.com googletagmanager.com",
        "connect-src 'self' *.nhost.run wss://*.nhost.run nhost.run wss://nhost.run discord.com api.segment.io api.segment.com cdn.segment.com nhost.zendesk.com api.github.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: github.com *.githubusercontent.com *.gravatar.com *.nhost.run nhost.run",
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "frame-src 'self' js.stripe.com challenges.cloudflare.com",
        'block-all-mixed-content',
        'upgrade-insecure-requests',
      ].join('; ')};`;
  }
}

const PROJECT_PATH = '/orgs/:orgSlug/projects/:appSubdomain';

// Old project URLs from before the area-based project layout, mapped to the
// page that now hosts their content. Incoming query strings are preserved by
// Next.js and merged into the destination query.
const legacyProjectRedirects = [
  // Project settings
  ['/settings/compute-resources', '/settings?tab=compute-resources'],
  ['/settings/environment-variables', '/settings?tab=environment-variables'],
  ['/settings/secrets', '/settings?tab=secrets'],
  ['/settings/editor', '/settings?tab=editor'],

  // Auth
  ['/settings/sign-in-methods', '/auth/settings?tab=sign-in-methods'],
  ['/settings/oauth2-provider', '/auth/settings?tab=oauth2-provider'],
  ['/settings/smtp', '/auth/settings?tab=smtp'],
  ['/settings/authentication', '/auth/settings?tab=authentication'],
  [
    '/settings/roles-and-permissions',
    '/auth/settings?tab=roles-and-permissions',
  ],
  ['/settings/jwt', '/auth/settings?tab=jwt'],
  // Custom domains and rate limiting were split across the area settings
  // pages; Auth was the first section on both old pages.
  ['/settings/custom-domains', '/auth/settings?tab=custom-domain'],
  ['/settings/rate-limiting', '/auth/settings?tab=rate-limiting'],

  // Database
  ['/settings/database', '/database/settings'],
  ['/backups', '/database/backups'],
  [
    '/database/browser/:dataSourceSlug/editor',
    '/database/console/:dataSourceSlug',
  ],

  // GraphQL
  ['/hasura', '/graphql/console'],
  ['/settings/hasura', '/graphql/settings'],

  // Storage
  ['/storage', '/storage/buckets'],
  ['/storage/bucket/:bucketId*', '/storage/buckets/:bucketId*'],
  ['/settings/storage', '/storage/settings'],

  // Functions
  ['/functions', '/functions/browser'],
  // `browser` and `settings` are the new subpages and must not be redirected.
  [
    '/functions/:functionSlug((?!browser(?:/|$)|settings$).+)',
    '/functions/browser/:functionSlug',
  ],

  // Other area settings
  ['/settings/ai', '/ai/settings'],
  ['/settings/deployments', '/deployments/settings'],
  ['/settings/metrics', '/metrics/settings'],
].map(([source, destination]) => ({
  source: `${PROJECT_PATH}${source}`,
  destination: `${PROJECT_PATH}${destination}`,
  permanent: true,
}));

module.exports = withBundleAnalyzer({
  turbopack: {},
  reactStrictMode: false,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
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
        source: '/orgs/:orgSlug/projects/:appSubdomain/database/browser',
        destination:
          '/orgs/:orgSlug/projects/:appSubdomain/database/browser/default',
        permanent: true,
      },
      ...legacyProjectRedirects,
    ];
  },
});

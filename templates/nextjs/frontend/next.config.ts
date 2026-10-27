import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Next refuses an action body over 1 MB by default. 6 MB rather than 5
    // leaves room for the multipart framing around a file at
    // MAX_AVATAR_BYTES (src/app/account/avatar.ts).
    serverActions: { bodySizeLimit: '6mb' },
    // Every page reads the session, so every page is dynamic, and by default
    // the browser keeps none of them: going home and back to the account
    // rendered both again on the server. Kept for 30 seconds, a page visited
    // that recently comes back at once. Nothing goes stale that matters:
    // signing in or out sets cookies in a Server Action, which clears this
    // cache, and each change on the account page refreshes it.
    staleTimes: { dynamic: 30 },
  },
  // frame-ancestors is the part of a CSP that costs nothing: it closes
  // clickjacking on authenticated pages without touching script execution,
  // so a full script-src policy, which would need nonce plumbing through the
  // App Router, stays out of scope for a starter.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // The avatar route serves stored files on this origin. Storage sandboxes
      // HTML and SVG on its own origin, so this does the same here behind the
      // route's raster-only check. It lives here because Next sets these
      // headers before the handler runs and drops a handler's header of the
      // same name. This later entry replaces only the CSP above.
      {
        source: '/api/avatar/:id',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; sandbox; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

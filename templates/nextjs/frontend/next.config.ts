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
  },
  // The access token is readable by JS (see accessTokenCookieOptions in
  // src/lib/nhost/server.ts), so an XSS here can act as the user until that
  // token expires. frame-ancestors is the part of a CSP that costs
  // nothing: it closes clickjacking on authenticated pages without touching
  // script execution, so a full script-src policy - which would need nonce
  // plumbing through the App Router - stays out of scope for a starter.
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

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
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
    ];
  },
};

export default nextConfig;

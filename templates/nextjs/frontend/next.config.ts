import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Next refuses an action body over 1 MB by default. 6 MB rather than 5
    // leaves room for the multipart framing around a file at MAX_AVATAR_BYTES
    // (src/app/account/avatar.ts).
    serverActions: { bodySizeLimit: '6mb' },
    // Every page reads the session, so every page is dynamic, and by default
    // the browser keeps none of them: going home and back to the account
    // rendered both again on the server.
    staleTimes: { dynamic: 30 },
  },
  // frame-ancestors is the part of a CSP that costs nothing: it closes
  // clickjacking on authenticated pages without touching script execution, so a
  // full script-src policy.
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
      // The avatar route serves stored files on this origin.
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

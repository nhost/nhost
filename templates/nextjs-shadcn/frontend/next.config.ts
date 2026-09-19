import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  // uploadAvatar (frontend/src/app/profile/actions.ts) is a Server Action
  // that carries a file, so it needs this raised past Next's 1 MB default -
  // see MAX_AVATAR_BYTES there for the two ceilings above this number.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // The session cookie is readable by JS (see cookieOptions in
  // src/lib/nhost/server.ts), so an XSS here is a full account takeover, not
  // just a leaked cookie. frame-ancestors is the part of a CSP that costs
  // nothing: it closes clickjacking on authenticated pages (delete account,
  // publish profile) without touching script execution, so a full script-src
  // policy - which would need nonce plumbing through the App Router - stays
  // out of scope for a starter.
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

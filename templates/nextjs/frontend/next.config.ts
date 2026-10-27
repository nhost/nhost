import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Next refuses an action body over 1 MB by default. 5 MB leaves room for
    // the multipart framing around a file at MAX_AVATAR_BYTES
    // (src/app/account/avatar.ts). Vercel rejects a request body over 4.5 MB
    // before Next sees it, so raising this does not raise the cap there.
    serverActions: { bodySizeLimit: '5mb' },
    // Every page reads the session, so every page is dynamic, and by default
    // the browser keeps none of them: going home and back to the account
    // rendered both again on the server.
    staleTimes: { dynamic: 30 },
  },
  // frame-ancestors closes clickjacking without touching script execution. A
  // script-src policy would need nonce plumbing through the App Router, so the
  // starter leaves it out.
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

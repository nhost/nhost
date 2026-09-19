import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV !== 'production';

// The four backend services this app talks to, spelled out rather than covered
// by a wildcard. `*.nhost.run` is a namespace anybody can get a subdomain in,
// so allowing it lets injected script post the session cookie, which is
// readable by JavaScript on purpose, to a project the attacker provisioned.
//
// Read from the pair `src/lib/nhost/env.ts` reads, and defaulted the same way
// it defaults them: each variable falls back to `local` on its own. Defaulting
// them together would let a half-configured build, with only one of the two
// set, emit a header naming a different host than the bundle talks to, silently
// refusing every backend call. This file and `next build` share one process,
// so the origins in the header are the ones in the bundle.
const backendOrigins = ((): string[] => {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local';
  const region = process.env.NEXT_PUBLIC_NHOST_REGION || 'local';

  return ['auth', 'graphql', 'storage', 'functions'].map(
    (service) => `https://${subdomain}.${service}.${region}.nhost.run`,
  );
})();

const websocketOrigins = backendOrigins.map((origin) =>
  origin.replace('https://', 'wss://'),
);

// The auth service mints a Gravatar URL as the default `avatar_url` on sign-up
// (`auth.user.gravatar.enabled` defaults to true in the backend config
// `nhost init` writes), and the template renders that value straight into an
// <img> via Radix `AvatarImage`. Pinning `img-src` to the project's own
// origins therefore only works if Gravatar is disabled; because it ships
// enabled, allow the Gravatar image host so a user who has a Gravatar keeps
// their avatar out of the box. Drop this if you turn
// `auth.user.gravatar.enabled` off in `backend/nhost/nhost.toml`.
export const avatarImageOrigins = ['https://www.gravatar.com'] as const;

// The session cookie is readable by JavaScript on purpose (see
// `src/lib/nhost/server.ts`), so the cheapest way to make that tradeoff
// smaller is to bound where injected script could send it. `unsafe-inline` on
// scripts is what Next's own bootstrap needs without a nonce, so this is a
// floor rather than a finished policy: tighten it with a per-request nonce in
// `src/proxy.ts` if you are shipping something that warrants it.
//
export const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${[...backendOrigins, ...avatarImageOrigins].join(' ')}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[...backendOrigins, ...websocketOrigins].join(' ')}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};

export default nextConfig;

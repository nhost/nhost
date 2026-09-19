import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarImageOrigins, csp } from './next.config';

const directive = (name: string): string => {
  const found = csp
    .split('; ')
    .find((entry) => entry === name || entry.startsWith(`${name} `));
  if (!found) {
    throw new Error(`CSP has no ${name} directive: ${csp}`);
  }
  return found;
};

describe('Content-Security-Policy', () => {
  // Regression guard: the auth service fills `avatar_url` with a Gravatar URL
  // on sign-up by default, and the template renders it straight into an <img>.
  // If img-src stops allowing the Gravatar host, every such avatar is refused
  // and degrades silently to the initials fallback, so keep the two in sync.
  it('allows every origin an avatar_url can point at', () => {
    const imgSrc = directive('img-src');
    for (const origin of avatarImageOrigins) {
      expect(imgSrc).toContain(origin);
    }
  });
});

describe('backend origins in a half-configured build', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // With only the subdomain set, `env.ts` still defaults the region to `local`
  // and the SDK talks to `https://myproj.<service>.local.nhost.run`. The header
  // must name that exact host, not `local.<service>.local.nhost.run`, or the
  // CSP refuses every backend call.
  it('names the host the bundle talks to when the region is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'myproj');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', '');
    vi.resetModules();
    const { csp: freshCsp } = await import('./next.config');

    const connectSrc = freshCsp
      .split('; ')
      .find((entry) => entry.startsWith('connect-src '));

    expect(connectSrc).toContain('https://myproj.auth.local.nhost.run');
    expect(connectSrc).toContain('wss://myproj.graphql.local.nhost.run');
    expect(connectSrc).not.toContain('https://local.auth.local.nhost.run');
  });
});

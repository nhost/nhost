import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appOrigin,
  localMailboxURL,
  nhostRegion,
  nhostSubdomain,
} from '@/lib/nhost/env';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Nhost backend coordinates', () => {
  it('falls back to the local stack when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', undefined);
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', undefined);

    expect(nhostSubdomain()).toBe('local');
    expect(nhostRegion()).toBe('local');
  });

  it('uses the configured project', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');

    expect(nhostSubdomain()).toBe('abcdefgh');
    expect(nhostRegion()).toBe('eu-central-1');
  });

  it('treats an empty value as unset', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', '');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', '');

    expect(nhostSubdomain()).toBe('local');
    expect(nhostRegion()).toBe('local');
  });

  // Regression guard: a server-only pair used to sit alongside the public one,
  // so setting just those names pointed server components at the real project
  // while the browser silently kept talking to the local stack.
  it('ignores server-only names so the two halves cannot disagree', () => {
    vi.stubEnv('NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NHOST_REGION', 'eu-central-1');
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', undefined);
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', undefined);

    expect(nhostSubdomain()).toBe('local');
    expect(nhostRegion()).toBe('local');
  });
});

// Auth emails point back at this origin. Reading it from the request's own
// headers instead would let anyone who can reach the app aim somebody else's
// password-reset link at a host they control, with only the backend's
// allowedUrls glob standing in the way.
describe('app origin', () => {
  it('defaults to the dev server the generated backend allows', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', undefined);

    expect(appOrigin()).toBe('http://localhost:3000');
  });

  it('uses the configured origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://app.example');

    expect(appOrigin()).toBe('https://app.example');
  });

  it('treats an empty value as unset', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', '');

    expect(appOrigin()).toBe('http://localhost:3000');
  });
});

describe('local mailbox', () => {
  it('points at the mailbox of the running local stack', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', undefined);
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', undefined);

    expect(localMailboxURL()).toBe('https://local.mailhog.local.nhost.run');
  });

  it('is absent against a real project, where emails are delivered', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');

    expect(localMailboxURL()).toBeNull();
  });
});

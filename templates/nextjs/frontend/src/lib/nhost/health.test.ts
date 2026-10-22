import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBackendReachable } from '@/lib/nhost/health';

describe('isBackendReachable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks the local auth service's health endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);

    expect(await isBackendReachable()).toBe(true);
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://local.auth.local.nhost.run/v1/healthz',
    );
  });

  it("asks a cloud project's own auth service", async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'abcdefgh');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);

    await isBackendReachable();

    expect(fetch.mock.calls[0]?.[0]).toBe(
      'https://abcdefgh.auth.eu-central-1.nhost.run/v1/healthz',
    );
  });

  it('is false when the service answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );

    expect(await isBackendReachable()).toBe(false);
  });

  it('is false when nothing answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    expect(await isBackendReachable()).toBe(false);
  });
});

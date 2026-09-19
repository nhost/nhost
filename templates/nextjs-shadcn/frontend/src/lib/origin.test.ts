import { afterEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '@/lib/origin';

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'host' ? 'dev.local:3000' : null),
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('appOrigin', () => {
  it('uses the configured origin, normalized, in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'https://app.example.com/');

    await expect(appOrigin()).resolves.toBe('https://app.example.com');
  });

  it('fails closed when APP_ORIGIN is unset in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', undefined);

    await expect(appOrigin()).rejects.toThrow(/APP_ORIGIN/);
  });

  it('rejects an APP_ORIGIN with no protocol', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'example.com');

    await expect(appOrigin()).rejects.toThrow(/APP_ORIGIN/);
  });

  it('rejects an APP_ORIGIN that carries a path', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ORIGIN', 'https://example.com/app/');

    await expect(appOrigin()).rejects.toThrow(/APP_ORIGIN/);
  });

  it('falls back to the request Host over http in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_ORIGIN', undefined);

    await expect(appOrigin()).resolves.toBe('http://dev.local:3000');
  });
});

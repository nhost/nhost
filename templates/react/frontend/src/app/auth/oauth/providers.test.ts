import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredProviders } from '@/app/auth/oauth/providers';

const ids = (value?: string) =>
  configuredProviders(value).map((provider) => provider.id);

describe('configuredProviders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads a comma-separated list, forgiving spaces and case', () => {
    expect(ids(' GitHub , google ')).toEqual(['github', 'google']);
  });

  it('turns on nothing unless the build was given providers', () => {
    vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', '');

    expect(ids()).toEqual([]);
  });
});

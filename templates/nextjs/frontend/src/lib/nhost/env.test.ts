import { afterEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '@/lib/nhost/env';

describe('appOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the Vercel production domain over https', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', '');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL', 'myapp.vercel.app');

    expect(appOrigin()).toBe('https://myapp.vercel.app');
  });
});

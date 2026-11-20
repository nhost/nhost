// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '@/lib/nhost/env';

describe('appOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the origin the app is served from', () => {
    vi.stubEnv('VITE_APP_ORIGIN', '');

    expect(appOrigin()).toBe(window.location.origin);
  });

  it('prefers the origin the build was given', () => {
    vi.stubEnv('VITE_APP_ORIGIN', 'https://app.example');

    expect(appOrigin()).toBe('https://app.example');
  });
});

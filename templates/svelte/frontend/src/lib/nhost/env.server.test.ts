import { describe, expect, it, vi } from 'vitest';
import { appOrigin } from './env.server.ts';

vi.mock('$app/env/private', () => ({
  APP_ORIGIN: '',
  NHOST_REGION: '',
  NHOST_SUBDOMAIN: '',
  VERCEL_PROJECT_PRODUCTION_URL: 'myapp.vercel.app',
}));

describe('appOrigin', () => {
  it('falls back to the Vercel production domain over https', () => {
    expect(appOrigin()).toBe('https://myapp.vercel.app');
  });
});

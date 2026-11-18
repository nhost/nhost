import { afterEach, describe, expect, it, vi } from 'vitest';
import LinkedAccountsSetting from '@/app/auth/oauth/linked/LinkedAccountsSetting';
import ProviderSignIn from '@/app/auth/oauth/ProviderSignIn';

// The registry reads the providers once, when it loads.
const registry = async (providers: string) => {
  vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', providers);
  vi.resetModules();
  return import('@/app/signin/methods');
};

describe('oauth in the registry', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is left out when no provider is set up', async () => {
    const { buttons, buttonSettings } = await registry('');

    expect(buttons).toEqual([]);
    expect(buttonSettings).toEqual([]);
  });

  it('adds the buttons and the account row once one is', async () => {
    const { buttons, buttonSettings } = await registry('github');

    expect(buttons.map(({ name }) => name)).toEqual([ProviderSignIn.name]);
    expect(buttonSettings.map(({ name }) => name)).toEqual([
      LinkedAccountsSetting.name,
    ]);
  });
});

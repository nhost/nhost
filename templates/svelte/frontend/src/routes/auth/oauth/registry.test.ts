import { afterEach, describe, expect, it, vi } from 'vitest';
import LinkedAccountsSetting from './linked/LinkedAccountsSetting.svelte';
import ProviderSignIn from './ProviderSignIn.svelte';

const env = vi.hoisted(() => ({ NHOST_OAUTH_PROVIDERS: '' }));

vi.mock('$app/env/public', () => env);

// The registry reads the providers once, when it loads.
const registry = async (providers: string) => {
  env.NHOST_OAUTH_PROVIDERS = providers;
  vi.resetModules();
  return import('#routes/signin/methods.ts');
};

describe('oauth in the registry', () => {
  afterEach(() => {
    env.NHOST_OAUTH_PROVIDERS = '';
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

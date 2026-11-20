import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';

// The registry reads the providers once, when it loads.
const registry = async (providers: string) => {
  vi.stubEnv('VITE_NHOST_OAUTH_PROVIDERS', providers);
  vi.resetModules();
  return import('@/app/signin/methods');
};

// An SFC's name, from its file.
const names = (components: Component[]): unknown[] =>
  components.map((component) => (component as { __name?: string }).__name);

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

    expect(names(buttons)).toEqual(['ProviderSignIn']);
    expect(names(buttonSettings)).toEqual(['LinkedAccountsSetting']);
  });
});

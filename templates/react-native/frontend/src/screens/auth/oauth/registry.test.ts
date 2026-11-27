import LinkedAccountsSetting from '@/screens/auth/oauth/linked/LinkedAccountsSetting';
import ProviderSignIn from '@/screens/auth/oauth/ProviderSignIn';
import type * as Methods from '@/screens/signin/methods';

const saved = process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;

afterEach(() => {
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;
  } else {
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = saved;
  }
});

// The registry reads the providers once, when it loads.
function registry(providers: string): typeof Methods {
  process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = providers;
  let loaded: typeof Methods | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<typeof Methods>('@/screens/signin/methods');
  });
  return loaded as typeof Methods;
}

// A fresh load of React Native takes seconds.
jest.setTimeout(30_000);

describe('oauth in the registry', () => {
  it('is left out when no provider is set up', () => {
    const { buttons, buttonSettings } = registry('');

    expect(buttons).toEqual([]);
    expect(buttonSettings).toEqual([]);
  });

  it('adds the buttons and the account row once one is', () => {
    const { buttons, buttonSettings } = registry('github');

    expect(buttons.map(({ name }) => name)).toEqual([ProviderSignIn.name]);
    expect(buttonSettings.map(({ name }) => name)).toEqual([
      LinkedAccountsSetting.name,
    ]);
  });
});

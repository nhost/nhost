import {
  configuredProviders,
  inAppBrowserURL,
} from '@/screens/auth/oauth/providers';

const ids = (value?: string) =>
  configuredProviders(value).map((provider) => provider.id);

describe('configuredProviders', () => {
  const saved = process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;
    } else {
      process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = saved;
    }
  });

  it('reads a comma-separated list, forgiving spaces and case', () => {
    expect(ids(' GitHub , google ')).toEqual(['github', 'google']);
  });

  it('turns on nothing unless the build was given providers', () => {
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = '';

    expect(ids()).toEqual([]);
  });

  it('reads the build setting when given nothing', () => {
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = 'google,unknown';

    expect(ids()).toEqual(['google']);
  });
});

describe('inAppBrowserURL', () => {
  it('encodes the brackets and leaves the rest as it was', () => {
    expect(
      inAppBrowserURL(
        'https://auth.example/v1/signin/provider/github?redirectTo=nhost-starter%3A%2F%2Faccount&upstreamParams[prompt]=select_account',
      ),
    ).toBe(
      'https://auth.example/v1/signin/provider/github?redirectTo=nhost-starter%3A%2F%2Faccount&upstreamParams%5Bprompt%5D=select_account',
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext } from 'expo/config';
import {
  APP_SCHEME,
  appUrl,
  nhostRegion,
  nhostSubdomain,
  oauthProviders,
  passkeyDomain,
} from '@/lib/nhost/env';
import appConfig from '../../../app.config';

const NHOST_TOML = join(__dirname, '../../../../nhost/nhost.toml');

const KEYS = [
  'EXPO_PUBLIC_NHOST_SUBDOMAIN',
  'EXPO_PUBLIC_NHOST_REGION',
  'EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS',
  'EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN',
] as const;

// Under jest, babel-preset-expo does not inline these as `expo export` does:
// it reads them through `expo/virtual/env`, which holds the `process.env`
// object from load time. A test can change its keys, but replacing
// `process.env` would leave the app reading the old object.
describe('env', () => {
  const saved = KEYS.map((key) => [key, process.env[key]] as const);

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('falls back to the local backend', () => {
    delete process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN;
    process.env.EXPO_PUBLIC_NHOST_REGION = '';

    expect(nhostSubdomain()).toBe('local');
    expect(nhostRegion()).toBe('local');

    process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN = 'abcdefgh';
    process.env.EXPO_PUBLIC_NHOST_REGION = 'eu-central-1';

    expect(nhostSubdomain()).toBe('abcdefgh');
    expect(nhostRegion()).toBe('eu-central-1');
  });

  it('reads an empty switch as unset', () => {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = '';
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = '';

    expect(passkeyDomain()).toBeUndefined();
    expect(oauthProviders()).toBeUndefined();

    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = 'example.com';
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = 'github,google';

    expect(passkeyDomain()).toBe('example.com');
    expect(oauthProviders()).toBe('github,google');
  });
});

describe('appUrl', () => {
  it('links back into the app at a path', () => {
    expect(appUrl()).toBe('nhost-starter://');
    expect(appUrl('/account')).toBe('nhost-starter://account');
    expect(appUrl('/auth/password/reset', { flow: 'f1' })).toBe(
      'nhost-starter://auth/password/reset?flow=f1',
    );
  });

  it("keeps the path's own query and fragment around the added params", () => {
    expect(appUrl('/account/settings?tab=1#top', { flow: 'a b&c' })).toBe(
      'nhost-starter://account/settings?tab=1&flow=a%20b%26c#top',
    );
  });

  // Auth only redirects to URLs nhost.toml allows, and the OS only opens the
  // app for the scheme it registered.
  it('uses the scheme the app registers and auth allows', () => {
    const config = appConfig({ config: {} } as ConfigContext);
    const toml = readFileSync(NHOST_TOML, 'utf8');

    expect(config.scheme).toBe(APP_SCHEME);
    expect(toml).toContain(`clientUrl = '${appUrl()}'`);
    expect(toml).toContain(`allowedUrls = ['${appUrl()}**']`);
  });
});

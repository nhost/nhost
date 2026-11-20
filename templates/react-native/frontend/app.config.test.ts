import type { ConfigContext } from 'expo/config';
import appConfig from './app.config';

const saved = process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;

const config = () => appConfig({ config: {} } as ConfigContext);

afterEach(() => {
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
  } else {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = saved;
  }
});

// iOS offers passkeys only for a domain the app's entitlements name.
describe('app config', () => {
  it('names no associated domain while passkeys are off', () => {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
    expect(config().ios).not.toHaveProperty('associatedDomains');

    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = '';
    expect(config().ios).not.toHaveProperty('associatedDomains');
  });

  it('names the passkey domain for web credentials once set', () => {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = 'example.com';

    expect(config().ios?.associatedDomains).toEqual([
      'webcredentials:example.com',
    ]);
  });
});

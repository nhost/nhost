import { describe, expect, it, vi } from 'vitest';

// `redirectURL` builds a deep link with this, and the real one needs a device.
vi.mock('expo-linking', () => ({
  createURL: (path: string) => `nhoststarter://${path}`,
}));

const { authRedirectURL } = await import('@/lib/nhost/redirect');

describe('authRedirectURL', () => {
  // No sign-in method is named here, deliberately. A method is meant to be
  // deletable by removing its directory, and a path named in shared code would
  // make this file the thing that still refers to it afterwards.
  it('points at the requested screen', () => {
    expect(authRedirectURL('/protected')).toBe('nhoststarter:///protected');
    expect(authRedirectURL('/protected/settings?tab=1')).toBe(
      'nhoststarter:///protected/settings?tab=1',
    );
  });

  // `next` arrives on the URL that opened the screen, which a deep link can
  // carry anything in. Each of these, left alone, would send a link that the
  // backend emails to the user somewhere other than this app.
  it('refuses anything that would leave this app', () => {
    for (const hostile of [
      '//evil.example',
      '/\\evil.example',
      'evil.example',
      'https://evil.example/',
      'javascript:alert(1)',
      '/\t/evil.example',
    ]) {
      expect(authRedirectURL(hostile)).toBe('nhoststarter:///');
    }
  });
});

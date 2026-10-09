import { describe, expect, it } from 'vitest';
import { DEFAULT_DESTINATION, signInDestination } from '@/signin/destination';

describe('signInDestination', () => {
  it('keeps a path inside the app', () => {
    expect(signInDestination('/profile')).toBe('/profile');
    expect(signInDestination('/protected/settings?tab=1')).toBe(
      '/protected/settings?tab=1',
    );
  });

  it('falls back when nothing was asked for', () => {
    expect(signInDestination(undefined)).toBe(DEFAULT_DESTINATION);
    expect(signInDestination('')).toBe(DEFAULT_DESTINATION);
  });

  // A `next` arrives from whatever opened the sign-in screen, a deep link
  // included, so it is attacker-controlled: anything that leaves the app is
  // dropped.
  it('refuses to send anyone out of the app', () => {
    for (const hostile of [
      'https://evil.example/login',
      '//evil.example',
      'http://evil.example',
      'evil.example',
      'javascript:alert(1)',
    ]) {
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // The forms that look like a path but are not. A URL parser resolves each of
  // these to https://evil.example/, and each one passes a "starts with one
  // slash but not two" check, which is why this is decided by resolving the
  // value rather than by matching its shape.
  it('refuses the forms a URL parser reads as another origin', () => {
    for (const hostile of [
      '/\\evil.example',
      '/\\\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r/evil.example',
    ]) {
      expect(new URL(hostile, 'https://app.example').origin).toBe(
        'https://evil.example',
      );
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // Safe only because the value comes back as given. Decoding it first would
  // turn these into paths a URL parser reads as `//` or `/\`.
  it('keeps encoded forms as given', () => {
    for (const path of [
      '/%09/evil.example',
      '/%2F%2Fevil.example',
      '/%5Cevil.example',
    ]) {
      const kept = signInDestination(path);

      expect(kept).toBe(path);
      expect(new URL(kept, 'https://app.example').origin).toBe(
        'https://app.example',
      );
    }
  });

  // Expo Router resolves these as a URL and React Navigation reads them as
  // written, so the same `next` would land on different screens under each.
  it('refuses a path the two navigation systems would read differently', () => {
    for (const path of [
      '/auth/../protected',
      '/./protected',
      '/..//evil.example',
      '/.//evil.example',
      '/protected#top',
      '/protected?tab=1#top',
      '/a b',
      '/notes/café',
    ]) {
      expect(signInDestination(path)).toBe(DEFAULT_DESTINATION);
    }
  });

  it('takes the first value when the parameter is repeated', () => {
    expect(signInDestination(['/profile', '/protected'])).toBe('/profile');
    expect(signInDestination(['//evil.example', '/profile'])).toBe(
      DEFAULT_DESTINATION,
    );
  });
});

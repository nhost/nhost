import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESTINATION,
  signInDestination,
  signInHref,
} from '@/app/signin/destination';

describe('signInDestination', () => {
  it('keeps a path on this site', () => {
    expect(signInDestination('/profile')).toBe('/profile');
    expect(signInDestination('/account/settings?tab=1')).toBe(
      '/account/settings?tab=1',
    );
  });

  // A `?next=` arrives from whatever put the visitor on the sign-in page, so
  // it is attacker-controlled: anything that leaves this origin is dropped.
  it('refuses to send anyone off this origin', () => {
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

  // The forms that look like a path but are not.
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

  // These stay on this site when resolved once, but the browser normalizes the
  // path when an auth email or OAuth redirect lands on it, and `//evil.example`
  // read back as a URL is another origin.
  it('refuses dot segments that normalize to another origin', () => {
    for (const hostile of [
      '/..//evil.example',
      '/.//evil.example',
      '/profile/..//evil.example',
      '/%2e%2e//evil.example',
      '/.%2E//evil.example',
      '/..\\/evil.example',
      '/.\t.//evil.example',
    ]) {
      const landed = new URL(hostile, 'https://app.example').pathname;

      expect(landed).toBe('//evil.example');
      expect(new URL(landed, 'https://app.example').origin).toBe(
        'https://evil.example',
      );
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // Safe only because the value comes back as given. Decoding it first would
  // turn these into paths a URL parser reads as `//` or `/\`.
  it('keeps percent-encoded forms as given', () => {
    for (const path of [
      '/%09/evil.example',
      '/%2F%2Fevil.example',
      '/%5Cevil.example',
      '/..%2F%2Fevil.example',
    ]) {
      const kept = signInDestination(path);

      expect(kept).toBe(path);
      expect(new URL(kept, 'https://app.example').origin).toBe(
        'https://app.example',
      );
    }
  });
});

describe('signInHref', () => {
  it('round-trips through signInDestination', () => {
    const destination = '/account/settings?tab=api&q=a b';
    const next = new URL(
      signInHref(destination),
      'http://localhost',
    ).searchParams.get('next');

    expect(signInDestination(next ?? undefined)).toBe(destination);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESTINATION,
  signInDestination,
  signInHref,
} from '@/app/signin/destination';

describe('signInDestination', () => {
  it('keeps a path on this site', () => {
    expect(signInDestination('/profile')).toBe('/profile');
    expect(signInDestination('/protected/settings?tab=1')).toBe(
      '/protected/settings?tab=1',
    );
  });

  it('falls back when nothing was asked for', () => {
    expect(signInDestination(undefined)).toBe(DEFAULT_DESTINATION);
    expect(signInDestination('')).toBe(DEFAULT_DESTINATION);
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

  // The forms that look like a path but are not. Each of these resolves to
  // https://evil.example/ in a browser, and each one passes a "starts with one
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

  it('takes the first value when the parameter is repeated', () => {
    expect(signInDestination(['/profile', '/protected'])).toBe('/profile');
    expect(signInDestination(['//evil.example', '/profile'])).toBe(
      DEFAULT_DESTINATION,
    );
  });
});

describe('signInHref', () => {
  it('encodes the destination into the query', () => {
    expect(signInHref('/protected')).toBe('/signin?next=%2Fprotected');
  });

  it('round-trips through signInDestination', () => {
    const destination = '/protected/settings?tab=api&q=a b';
    const next = new URL(
      signInHref(destination),
      'http://localhost',
    ).searchParams.get('next');

    expect(signInDestination(next ?? undefined)).toBe(destination);
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESTINATION,
  signInDestination,
  signInHref,
} from '@/signin/destination';

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

  // These stay on this site when resolved once, but the browser normalizes the
  // path when an auth email or OAuth redirect lands on it, and `//evil.example`
  // read back as a URL is another origin. `%2e` counts as a dot, a backslash as
  // a slash, and a raw tab is stripped, so each spelling gets there.
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

  // Each resolves to `/` or a path on this site here, so the checks above keep
  // it. The auth service puts `%20` where the trailing space was, which the
  // browser does not trim, and a raw space or `|` makes it re-encode the path
  // with `%2F` decoded to `/`. Either way the browser lands on a path that
  // starts `//`.
  it('refuses a path the auth service would rewrite', () => {
    for (const hostile of [
      '/.//.. ',
      '/%2e//%2e%2e ',
      '/a b/..%2F..%2F%2Fevil.example',
      '/a|b/..%2F..%2F%2Fevil.example',
    ]) {
      const resolved = new URL(hostile, 'https://app.example');

      expect(resolved.origin).toBe('https://app.example');
      expect(resolved.pathname.startsWith('//')).toBe(false);
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // The browser leaves brackets raw in `location.pathname`.
  it('keeps square brackets in the path', () => {
    for (const path of ['/items/[1]', '/items/[a]/b?c=[d]']) {
      expect(signInDestination(path)).toBe(path);
    }
  });

  it('refuses a raw space or non-ASCII path but keeps it encoded', () => {
    expect(signInDestination('/café')).toBe(DEFAULT_DESTINATION);
    expect(signInDestination('/a b')).toBe(DEFAULT_DESTINATION);
    expect(signInDestination('/caf%C3%A9')).toBe('/caf%C3%A9');
    expect(signInDestination('/a%20b')).toBe('/a%20b');
  });

  it('keeps dot segments that normalize to a path on this site', () => {
    expect(signInDestination('/profile/../protected')).toBe(
      '/profile/../protected',
    );
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

import {
  DEFAULT_DESTINATION,
  signInDestination,
  signInHref,
} from '@/screens/signin/destination';

// The URL standard's resolution, from Node. React Native's global `URL` does
// not implement it, which is why `signInDestination` never resolves.
const resolve = (path: string) => new URL(path, 'https://app.example');

describe('signInDestination', () => {
  it('keeps a path in this app', () => {
    expect(signInDestination('/profile')).toBe('/profile');
    expect(signInDestination('/account/settings?tab=1')).toBe(
      '/account/settings?tab=1',
    );
    expect(signInDestination(['/profile', '/other'])).toBe('/profile');
  });

  // A `?next=` arrives from whatever opened the sign-in screen, a link
  // included, so it is attacker-controlled: anything that is not a path in
  // this app is dropped.
  it('refuses anything that is not a path', () => {
    for (const hostile of [
      'https://evil.example/login',
      '//evil.example',
      'http://evil.example',
      'evil.example',
      'javascript:alert(1)',
      'nhost-starter://account',
      undefined,
      [],
    ]) {
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // The forms that look like a path but are not.
  it('refuses the forms a URL parser reads as another host', () => {
    for (const hostile of [
      '/\\evil.example',
      '/\\\\evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/\r/evil.example',
    ]) {
      expect(resolve(hostile).origin).toBe('https://evil.example');
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  it('refuses dot segments that normalize to another host', () => {
    for (const hostile of [
      '/..//evil.example',
      '/.//evil.example',
      '/profile/..//evil.example',
      '/%2e%2e//evil.example',
      '/.%2E//evil.example',
      '/..\\/evil.example',
      '/.\t.//evil.example',
    ]) {
      const landed = resolve(hostile).pathname;

      expect(landed).toBe('//evil.example');
      expect(resolve(landed).origin).toBe('https://evil.example');
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // Nothing here resolves a path, so a dot segment is refused even where
  // resolving it would stay in the app.
  it('refuses every dot segment', () => {
    for (const path of ['/account/../profile', '/./account', '/account/.']) {
      expect(signInDestination(path)).toBe(DEFAULT_DESTINATION);
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
      expect(resolve(kept).origin).toBe('https://app.example');
    }
  });
});

describe('signInHref', () => {
  it('round-trips through signInDestination', () => {
    const destination = '/account/settings?tab=api&q=a b';
    const next = new URLSearchParams(signInHref(destination).split('?')[1]).get(
      'next',
    );

    expect(signInDestination(next ?? undefined)).toBe(destination);
  });
});

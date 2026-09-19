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
      // A backslash sits in the authority position for a special scheme, so
      // the URL parser reads these as another origin the same way `//` is.
      '/\\evil.example',
      '/\\/evil.example',
      // A tab survives a plain second-character check but the parser strips it
      // before resolving, leaving `//evil.example`.
      '/\t/evil.example',
    ]) {
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // The guard resolves `next` against a throwaway origin, but the value it hands
  // back is what the browser actually navigates to. These all resolve onto that
  // throwaway origin, so validating the resolved URL and then returning the raw
  // string would accept them and send the browser to `placeholder.invalid` (or,
  // once a project swaps the placeholder for a real host, to that host). The
  // returned value has to stay on the origin it is resolved against.
  it('never returns a value that leaves the current origin', () => {
    const origin = 'https://app.example';
    for (const hostile of [
      '//placeholder.invalid/x',
      '/\\placeholder.invalid',
      '//placeholder%2Einvalid',
      '//PLACEHOLDER.INVALID',
      '//@placeholder.invalid',
      '/	/placeholder.invalid',
      '//placeholder.invalid//evil.example',
      // `..` collapses the path so a bare pathname would resurface a
      // protocol-relative `//evil.example`; the leading `//` is rejected.
      '/..//evil.example',
      '/x/../..//evil.example',
      // The collapse also resurfaces the throwaway host itself, the one host a
      // re-resolve against that same origin could never flag. A leading `//`
      // check does not care which host follows, so these fall back as well.
      '/..//placeholder.invalid/x',
      '/x/../..//placeholder.invalid',
      '/..//PLACEHOLDER.INVALID',
      '/..//@placeholder.invalid',
      '/..//placeholder.invalid:80/a',
      '/a/b/../../..//placeholder.invalid?q=1',
    ]) {
      const landed = new URL(signInDestination(hostile), origin);
      expect(landed.origin).toBe(origin);
    }
  });

  // These inputs collapse to a resolved pathname that an earlier guard fed to a
  // second URL parse, which threw. Both callers run this during Server
  // Component render under `dynamic = 'force-dynamic'` and the template ships no
  // error boundary, so a throw is a broken sign-in page: every one has to fall
  // back to the default, not throw.
  it('falls back instead of throwing on collapsing inputs', () => {
    for (const hostile of [
      '/..//[',
      '/..//%5Cevil.example',
      '/x/../..//e vil.example',
      '/..//evil.example:99999',
      '/..//placeholder.invalid%2Fx',
    ]) {
      expect(() => signInDestination(hostile)).not.toThrow();
      expect(signInDestination(hostile)).toBe(DEFAULT_DESTINATION);
    }
  });

  // Whatever `?next=` carries, the guard must never throw and must never hand
  // back a value a real origin would read as off-site. Fuzz the path with the
  // pieces that drive both failure modes and assert both invariants hold.
  it('never throws and never leaves the origin over generated inputs', () => {
    const origin = 'https://app.example';
    const pieces = [
      '',
      '/',
      '\\',
      '..',
      '.',
      'a',
      '@h',
      'placeholder.invalid',
      'evil.example',
      ':80',
      '%2F',
      '%5C',
      '\t',
      ' ',
      '[',
      '?q',
      '#f',
    ];
    for (const a of pieces) {
      for (const b of pieces) {
        for (const c of pieces) {
          const input = `/${a}/${b}/${c}`;
          let out = DEFAULT_DESTINATION;
          expect(() => {
            out = signInDestination(input);
          }).not.toThrow();
          expect(new URL(out, origin).origin).toBe(origin);
        }
      }
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

    // The space comes back percent-encoded, an equivalent URL: the guard returns
    // the resolved same-origin path rather than the raw query string.
    expect(signInDestination(next ?? undefined)).toBe(
      '/protected/settings?tab=api&q=a%20b',
    );
  });
});

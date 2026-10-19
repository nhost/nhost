import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';

const search = vi.hoisted(() => ({ current: '' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

const render = (query: string) => {
  search.current = query;
  return renderToStaticMarkup(<AuthErrorFromUrl />);
};

describe('AuthErrorFromUrl', () => {
  it('shows why an auth redirect failed', () => {
    const html = render(
      'error=disabled-endpoint&errorDescription=This+endpoint+is+disabled',
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('enable it in nhost/nhost.toml');
    expect(html).toContain('(disabled-endpoint)');
  });

  // A link can carry any description, and the notice sits on this app's own
  // origin, so showing it would let anyone put words in the app's mouth.
  it('never shows the description from the URL', () => {
    const crafted =
      'errorDescription=Your+account+is+suspended.+Verify+it+at+evil.example';

    const known = render(`error=disabled-endpoint&${crafted}`);
    const unknown = render(`error=account-locked&${crafted}`);

    expect(known).toContain('(disabled-endpoint)');
    expect(unknown).toContain('Sign-in failed.');
    for (const html of [known, unknown]) {
      expect(html).not.toContain('suspended');
      expect(html).not.toContain('evil.example');
    }
  });

  // The code is attacker text too until it matches a known one.
  it('never shows a code it does not know', () => {
    for (const code of [
      'account-suspended-call-us',
      '<img src=x onerror=alert(1)>',
    ]) {
      const html = render(`error=${encodeURIComponent(code)}`);

      expect(html).toContain('Sign-in failed.');
      expect(html).not.toContain('suspended');
      expect(html).not.toContain('call-us');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('onerror');
    }
  });

  it('shows no notice on an ordinary visit', () => {
    expect(render('')).toBe('');
    expect(render('next=%2Faccount')).toBe('');
  });

  it('needs the code, not only a description', () => {
    expect(render('errorDescription=x')).toBe('');
  });
});

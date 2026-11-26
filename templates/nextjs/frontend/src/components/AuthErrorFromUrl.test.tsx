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
});

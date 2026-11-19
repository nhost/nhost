import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import AuthErrorFromUrl from './AuthErrorFromUrl.svelte';

const search = vi.hoisted(() => ({ current: '' }));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(`http://localhost/?${search.current}`);
    },
  },
}));

const html = (query: string): string => {
  search.current = query;
  return render(AuthErrorFromUrl).body;
};

describe('AuthErrorFromUrl', () => {
  // A link can carry any description, and the notice sits on this app's own
  // origin, so showing it would let anyone put words in the app's mouth.
  it('never shows the description from the URL', () => {
    const crafted =
      'errorDescription=Your+account+is+suspended.+Verify+it+at+evil.example';

    const known = html(`error=disabled-endpoint&${crafted}`);
    const unknown = html(`error=account-locked&${crafted}`);

    expect(known).toContain('(disabled-endpoint)');
    expect(unknown).toContain('Sign-in failed.');
    for (const page of [known, unknown]) {
      expect(page).not.toContain('suspended');
      expect(page).not.toContain('evil.example');
    }
  });
});

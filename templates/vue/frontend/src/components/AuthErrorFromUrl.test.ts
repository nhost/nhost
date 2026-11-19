// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl.vue';
import { mountAt } from '@/test/mount';

const render = async (query: string) =>
  (await mountAt(AuthErrorFromUrl, `/?${query}`)).el.innerHTML;

describe('AuthErrorFromUrl', () => {
  // A link can carry any description, and the notice sits on this app's own
  // origin, so showing it would let anyone put words in the app's mouth.
  it('never shows the description from the URL', async () => {
    const crafted =
      'errorDescription=Your+account+is+suspended.+Verify+it+at+evil.example';

    const known = await render(`error=disabled-endpoint&${crafted}`);
    const unknown = await render(`error=account-locked&${crafted}`);

    expect(known).toContain('(disabled-endpoint)');
    expect(unknown).toContain('Sign-in failed.');
    for (const html of [known, unknown]) {
      expect(html).not.toContain('suspended');
      expect(html).not.toContain('evil.example');
    }
  });
});

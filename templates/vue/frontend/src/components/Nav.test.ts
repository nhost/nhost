// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import Nav from '@/components/Nav.vue';
import { hrefOf, mountAt } from '@/test/mount';

describe('Nav', () => {
  it('offers a signed-out visitor both ways in', async () => {
    const { el: nav } = await mountAt(Nav);

    expect(hrefOf(nav, 'Sign in')).toBe('/signin?intent=sign-in');
    expect(hrefOf(nav, 'Sign up')).toBe('/signin');
    expect(nav.innerHTML).not.toContain('href="/account"');
  });
});

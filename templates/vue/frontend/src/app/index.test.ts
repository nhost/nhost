// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import Home from '@/app/index.vue';
import { hrefOf, mountAt } from '@/test/mount';

describe('home page', () => {
  it('sends a signed-out visitor to sign up, or to sign in another way', async () => {
    const { el: page } = await mountAt(Home);

    expect(hrefOf(page, 'Sign up')).toBe('/signin');
    expect(hrefOf(page, 'another way in')).toBe('/signin?intent=sign-in');
  });
});

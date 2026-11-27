// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/index.vue';
import { hrefOf, mountAt } from '@/test/mount';

const session = vi.hoisted(() => ({
  current: null as { user: { id: string; email?: string } } | null,
}));

vi.mock('@/lib/nhost/auth', async () => {
  const { computed } = await import('vue');
  return { useSession: () => computed(() => session.current) };
});
vi.mock('@/lib/nhost/actions', () => ({ signOut: vi.fn() }));

describe('home page', () => {
  beforeEach(() => {
    session.current = null;
  });

  it('sends a signed-out visitor to sign up, or to sign in another way', async () => {
    const { el } = await mountAt(Home);

    expect(hrefOf(el, 'Sign up')).toBe('/signin');
    expect(hrefOf(el, 'another way in')).toBe('/signin?intent=sign-in');
  });

  it('reads its title as words, not just as a grid of names', async () => {
    const { el } = await mountAt(Home);

    expect(el.querySelector('h1')?.textContent).toBe('Nhost + Vue');
  });

  // The one page behind the session, so it is where a signed-in visitor is sent
  // from here.
  it('sends a signed-in visitor to the account page', async () => {
    session.current = { user: { id: 'user-id', email: 'ada@example.com' } };

    const { el } = await mountAt(Home);

    expect(el.textContent).toContain('signed in as ada@example.com');
    expect(hrefOf(el, 'Go to your account')).toBe('/account');
    expect(hrefOf(el, 'Sign up')).toBeUndefined();
  });
});

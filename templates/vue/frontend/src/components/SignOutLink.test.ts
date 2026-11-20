// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import SignOutLink from '@/components/SignOutLink.vue';
import { type Mounted, mountAt, routerAt, settle } from '@/test/mount';

const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/actions', () => ({ signOut }));

let mounted: Mounted;

const button = (): HTMLButtonElement | null =>
  mounted.el.querySelector('button');

async function click(): Promise<void> {
  button()?.click();
  await settle();
}

describe('sign-out link', () => {
  beforeEach(async () => {
    signOut.mockReset();
    mounted = await mountAt(() => h(SignOutLink, () => 'sign out'), '/page', {
      router: await routerAt('/page'),
    });
  });

  it('signs out once, however often it is pressed meanwhile', async () => {
    signOut.mockReturnValueOnce(new Promise(() => undefined));

    await click();
    await click();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(button()?.disabled).toBe(true);
    expect(mounted.el.querySelector('[role="alert"]')).toBeNull();
  });

  it('goes home once signed out', async () => {
    signOut.mockResolvedValueOnce({});

    await click();

    expect(mounted.router.currentRoute.value.path).toBe('/');
  });

  it('stays and says so when the sign-out did not reach the server', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await click();

    expect(mounted.router.currentRoute.value.path).toBe('/page');
    expect(mounted.el.querySelector('[role="alert"]')?.textContent).toContain(
      'You are still signed in.',
    );
  });
});

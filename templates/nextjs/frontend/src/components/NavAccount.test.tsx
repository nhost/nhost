// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NavAccount from '@/components/NavAccount';
import SignOutButton from '@/components/SignOutButton';
import { signOutFinished } from '@/components/useSignOut';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/account',
}));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(signedIn: boolean): Promise<void> {
  await act(async () =>
    root.render(
      <NavAccount
        signedOutPaths={[]}
        signedIn={signedIn ? <SignOutButton /> : null}
        signedOut={<span>Sign in</span>}
      />,
    ),
  );
}

const signOutButton = (): HTMLButtonElement | null =>
  container.querySelector('button');

describe('nav account', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOut.mockReset();
    signOutFinished();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await render(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Not once the server has answered and the page has come back, which on a
  // deployed backend is long enough to see the sign-out button again first.
  it('shows the ways in as soon as signing out starts', async () => {
    signOut.mockReturnValueOnce(new Promise(() => undefined));

    await act(async () => signOutButton()?.click());

    expect(signOutButton()).toBeNull();
    expect(container.textContent).toBe('Sign in');
  });

  it('keeps showing them on the way home', async () => {
    signOut.mockResolvedValueOnce({});

    await act(async () => signOutButton()?.click());

    expect(router.push).toHaveBeenCalledWith('/');
    expect(container.textContent).toBe('Sign in');
  });

  it('shows the account again when this browser is still signed in', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await act(async () => signOutButton()?.click());

    expect(signOutButton()?.textContent).toBe('Sign out');
  });

  // Signing in again later in the same tab shows the account, not the ways
  // in a finished sign-out left behind.
  it('lets go once the page comes back signed out', async () => {
    signOut.mockResolvedValueOnce({});
    await act(async () => signOutButton()?.click());

    await render(false);
    await render(true);

    expect(signOutButton()?.textContent).toBe('Sign out');
  });
});

// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutLink from '@/components/SignOutLink';
import ToastProvider from '@/components/Toast';
import { signOutFinished } from '@/components/useSignOut';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const button = (): HTMLButtonElement | null =>
  container.querySelector('button');

const toast = (): string | null =>
  container.querySelector('[role="status"]')?.textContent || null;

async function click(): Promise<void> {
  await act(async () => button()?.click());
}

describe('sign-out link', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOut.mockReset();
    // The sign-out under way is shared by the whole tab, and the nav that
    // would end it is not rendered here.
    signOutFinished();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ToastProvider>
          <SignOutLink>sign out</SignOutLink>
        </ToastProvider>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('signs out of this browser and goes home', async () => {
    signOut.mockResolvedValueOnce({});

    await click();

    expect(signOut).toHaveBeenCalledWith();
    expect(router.push).toHaveBeenCalledWith('/');
    expect(router.refresh).toHaveBeenCalled();
    expect(toast()).toBeNull();
  });

  // The cookies are gone whatever the auth service said, so it goes home
  // and says what went wrong on the way.
  it('goes home and says so when the auth service refused', async () => {
    signOut.mockResolvedValueOnce({
      error:
        'You are signed out on this device, but the sign-out request failed.',
    });

    await click();

    expect(router.push).toHaveBeenCalledWith('/');
    expect(toast()).toContain('the sign-out request failed');
  });

  it('stays put and says why when this browser is still signed in', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await click();

    expect(toast()).toBe(
      'Could not reach the server. You are still signed in.',
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(button()?.disabled).toBe(false);
  });

  // Until the nav is rendered signed out, the way home included.
  it('cannot be pressed again once signing out', async () => {
    let finish: (result: { error?: string }) => void = () => {};
    signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await click();
    expect(button()?.disabled).toBe(true);

    await act(async () => finish({}));
    expect(button()?.disabled).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

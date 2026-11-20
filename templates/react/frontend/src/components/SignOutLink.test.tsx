// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutLink from '@/components/SignOutLink';

const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

const button = (): HTMLButtonElement | null =>
  container.querySelector('button');

// React holds every async action in a page together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): Promise<object> =>
  new Promise((resolve) => {
    release = () => resolve({ stillSignedIn: true });
  });

async function click(): Promise<void> {
  await act(async () => button()?.click());
}

describe('sign-out link', () => {
  beforeEach(async () => {
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    router = createMemoryRouter(
      [
        { path: '/', element: <p>home</p> },
        { path: '/page', element: <SignOutLink>sign out</SignOutLink> },
      ],
      { initialEntries: ['/page'] },
    );
    await act(async () => root.render(<RouterProvider router={router} />));
  });

  afterEach(async () => {
    await act(async () => release());
    act(() => root.unmount());
    container.remove();
  });

  it('signs out once, however often it is pressed meanwhile', async () => {
    signOut.mockReturnValueOnce(held());

    await click();
    await click();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(button()?.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('goes home once signed out', async () => {
    signOut.mockResolvedValueOnce({});

    await click();

    expect(router.state.location.pathname).toBe('/');
  });

  it('stays and says so when the sign-out did not reach the server', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await click();

    expect(router.state.location.pathname).toBe('/page');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'You are still signed in.',
    );
  });
});

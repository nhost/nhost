// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutLink from '@/components/SignOutLink';

const signOutAndGoHome = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/actions', () => ({ signOutAndGoHome }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const button = (): HTMLButtonElement | null =>
  container.querySelector('button');

// React holds every async action in a page together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): Promise<object> =>
  new Promise((resolve) => {
    release = () => resolve({});
  });

async function click(): Promise<void> {
  await act(async () => button()?.click());
}

describe('sign-out link', () => {
  beforeEach(async () => {
    signOutAndGoHome.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<SignOutLink>sign out</SignOutLink>));
  });

  afterEach(async () => {
    await act(async () => release());
    act(() => root.unmount());
    container.remove();
  });

  // The action answers with the home page, so nothing comes back here on
  // success: the link stays pressed until that page replaces this one.
  it('signs out and holds until the home page arrives', async () => {
    signOutAndGoHome.mockReturnValueOnce(held());

    await click();
    await click();

    expect(signOutAndGoHome).toHaveBeenCalledTimes(1);
    expect(button()?.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('stays put and says why when this browser is still signed in', async () => {
    signOutAndGoHome.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
    });

    await click();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not reach the server. You are still signed in.',
    );
    expect(button()?.disabled).toBe(false);
  });
});

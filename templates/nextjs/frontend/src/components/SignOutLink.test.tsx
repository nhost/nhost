// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutLink from '@/components/SignOutLink';

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

async function click(): Promise<void> {
  await act(async () => button()?.click());
}

describe('sign-out link', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<SignOutLink>sign out</SignOutLink>));
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
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('stays put and says why when the action fails', async () => {
    signOut.mockResolvedValueOnce({ error: 'x' });

    await click();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'x',
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(button()?.disabled).toBe(false);
  });

  it('cannot be pressed again while signing out', async () => {
    let finish: (result: { error?: string }) => void = () => {};
    signOut.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await click();
    expect(button()?.disabled).toBe(true);

    await act(async () => finish({}));
    expect(button()?.disabled).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

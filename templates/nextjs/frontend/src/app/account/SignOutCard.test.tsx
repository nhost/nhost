// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutCard from '@/app/account/SignOutCard';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

describe('sign-out card', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<SignOutCard />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('signs out this session and goes home', async () => {
    signOut.mockResolvedValueOnce({});

    await click('Sign out of this browser');

    expect(signOut).toHaveBeenCalledWith({ all: false });
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('signs out everywhere with the flag set', async () => {
    signOut.mockResolvedValueOnce({});

    await click('Sign out of all devices');

    expect(signOut).toHaveBeenCalledWith({ all: true });
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('stays put and says why when the action fails', async () => {
    signOut.mockResolvedValueOnce({ error: 'still signed in' });

    await click('Sign out of all devices');

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'still signed in',
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

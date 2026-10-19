// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccountCard from '@/app/account/DeleteAccountCard';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const deleteAccount = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ deleteAccount }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

async function click(label: string): Promise<void> {
  await act(async () => button(label)?.click());
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('delete account card', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    deleteAccount.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<DeleteAccountCard />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // Nothing here can be undone, so the first press only asks.
  it('does not delete on the first press', async () => {
    await click('Delete account');

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(container.textContent).toContain('cannot be reversed');
  });

  it('deletes on the second press and leaves the page', async () => {
    deleteAccount.mockResolvedValueOnce({ success: true });

    await click('Delete account');
    await click('Delete it permanently');

    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('backs out without calling the action', async () => {
    await click('Delete account');
    await click('Keep my account');

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(button('Delete account')).toBeDefined();
  });

  it('stays put and says why when the action fails', async () => {
    deleteAccount.mockResolvedValueOnce({ error: 'still here' });

    await click('Delete account');
    await click('Delete it permanently');

    expect(text('alert')).toBe('still here');
    expect(router.push).not.toHaveBeenCalled();
  });
});

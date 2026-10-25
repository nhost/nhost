// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsSetting from '@/app/account/SessionsSetting';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const dialog = (): HTMLDialogElement | null =>
  container.querySelector('dialog');

// The row's button and the one that acts share their words, so each is
// looked for on its own side of the dialog.
async function clickRow(): Promise<void> {
  await act(async () =>
    container.querySelector<HTMLButtonElement>('li > button')?.click(),
  );
}

async function clickInDialog(label: string): Promise<void> {
  const button = [...(dialog()?.querySelectorAll('button') ?? [])].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

describe('sessions setting', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () => root.render(<SessionsSetting />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // This reaches past the browser it is clicked in, so the row only asks.
  it('does not sign out from the row', async () => {
    await clickRow();

    expect(signOut).not.toHaveBeenCalled();
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent).toContain('including this one');
  });

  // Signing out of this browser alone is in the nav, on every page, so the
  // only thing here is the one that covers the account.
  it('signs out everywhere once confirmed and goes home', async () => {
    signOut.mockResolvedValueOnce({});

    await clickRow();
    await clickInDialog('Sign out everywhere');

    expect(signOut).toHaveBeenCalledWith({ all: true });
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('backs out without calling the action', async () => {
    await clickRow();
    await clickInDialog('Cancel');

    expect(signOut).not.toHaveBeenCalled();
    expect(dialog()?.open).toBe(false);
  });

  it('stays open and says why when the action fails', async () => {
    signOut.mockResolvedValueOnce({ error: 'still signed in' });

    await clickRow();
    await clickInDialog('Sign out everywhere');

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe(
      'still signed in',
    );
    expect(dialog()?.open).toBe(true);
    expect(router.push).not.toHaveBeenCalled();
  });
});

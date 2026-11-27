// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSession } from '@/app/account/actions';
import SessionList from '@/app/account/SessionList';
import { formatSessionTime } from '@/app/account/sessions';
import ToastProvider from '@/components/Toast';

const refresh = vi.hoisted(() => vi.fn());
const signOutSession = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/account/actions', () => ({ signOutSession }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const sessions: AccountSession[] = [
  { id: 'laptop-000', createdAt: '2026-10-26T12:24:00Z', current: true },
  { id: 'phone-0000', createdAt: '2026-10-20T16:12:00Z', current: false },
];

let container: HTMLElement;
let root: Root;

const button = (row: number): HTMLButtonElement =>
  container
    .querySelectorAll('li')
    [row].querySelector('button') as HTMLButtonElement;

const dialog = (): HTMLDialogElement | null =>
  container.querySelector('dialog[open]');

// The line's button only asks; the dialog's is the one that signs out.
async function signOutLine(row: number): Promise<void> {
  await act(async () => button(row).click());
  await act(async () =>
    dialog()
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

// React holds every async action in a page together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): Promise<object> =>
  new Promise((resolve) => {
    release = () => resolve({ stillSignedIn: true });
  });

describe('session list', () => {
  beforeEach(async () => {
    refresh.mockReset();
    signOutSession.mockReset();
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    const router = createMemoryRouter(
      [
        {
          path: '/account',
          element: (
            <ToastProvider>
              <ul>
                <SessionList sessions={sessions} />
              </ul>
            </ToastProvider>
          ),
        },
      ],
      { initialEntries: ['/account'] },
    );
    await act(async () => root.render(<RouterProvider router={router} />));
  });

  afterEach(async () => {
    await act(async () => release());
    act(() => root.unmount());
    container.remove();
  });

  it('shows each session by its id and when it signed in, nothing more', () => {
    const line = container.querySelectorAll('li')[1];

    expect(line.querySelector('p')?.textContent).toBe(
      `phoneSigned in ${formatSessionTime('2026-10-20T16:12:00Z')}`,
    );
  });

  it('asks before signing out another session, naming it', async () => {
    await act(async () => button(1).click());

    expect(dialog()?.textContent).toContain('Sign out this session?');
    expect(dialog()?.textContent).toContain(
      'Session phone will need to sign in again.',
    );
    expect(signOutSession).not.toHaveBeenCalled();
  });

  // Deleting its own row would leave this browser holding a stored session
  // that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does', async () => {
    signOut.mockReturnValueOnce(held());

    await signOutLine(0);

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOutSession).not.toHaveBeenCalled();
    expect(button(0).textContent).toBe('Signing out…');
  });

  // Before the backend answers, so it cannot be pressed again while the list
  // loads again.
  it('takes another session off the list as soon as it is signed out', async () => {
    signOutSession.mockReturnValueOnce(new Promise(() => undefined));

    await signOutLine(1);

    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.textContent).not.toContain('phone');
  });

  it('loads the list again once another session is signed out', async () => {
    signOutSession.mockResolvedValueOnce({ success: true });

    await signOutLine(1);

    expect(signOutSession).toHaveBeenCalledWith('phone-0000');
    expect(refresh).toHaveBeenCalled();
  });
});

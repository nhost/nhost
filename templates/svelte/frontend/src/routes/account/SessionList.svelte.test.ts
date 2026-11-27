import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSession } from './actions.remote.ts';
import SessionList from './SessionList.svelte';
import { formatSessionTime } from './sessions.ts';

const refreshAll = vi.hoisted(() => vi.fn());
const goto = vi.hoisted(() => vi.fn());
const signOutSession = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ goto, refreshAll }));
vi.mock('./actions.remote.ts', () => ({ signOutSession }));
vi.mock('#lib/nhost/actions.remote.ts', () => ({ signOut }));

const sessions: AccountSession[] = [
  { id: 'laptop-000', createdAt: '2026-10-26T12:24:00Z', current: true },
  { id: 'phone-0000', createdAt: '2026-10-20T16:12:00Z', current: false },
];

let list: HTMLElement;

const line = (row: number): HTMLLIElement =>
  list.querySelectorAll('li')[row] as HTMLLIElement;

const button = (row: number): HTMLButtonElement =>
  line(row).querySelector('button') as HTMLButtonElement;

const dialog = (): HTMLDialogElement | null =>
  list.querySelector('dialog[open]');

// The line's button only asks; the dialog's is the one that signs out.
async function signOutLine(row: number): Promise<void> {
  await fireEvent.click(button(row));
  await fireEvent.submit(dialog()?.querySelector('form') as HTMLFormElement);
}

// Each test's pending sign-out is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): Promise<object> =>
  new Promise((resolve) => {
    release = () => resolve({});
  });

describe('session list', () => {
  beforeEach(() => {
    for (const fn of [refreshAll, goto, signOutSession, signOut]) {
      fn.mockReset();
    }
    list = document.body.appendChild(document.createElement('ul'));
    render(SessionList, { target: list, props: { sessions } });
  });

  afterEach(() => {
    release();
    list.remove();
  });

  // The browser's own zone, here the one the tests run in, once hydrated.
  it('shows each session by its id and when it signed in, nothing more', () => {
    expect(
      line(1).querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe(`phone Signed in ${formatSessionTime(sessions[1].createdAt)}`);
  });

  it('asks before signing out another session, naming it', async () => {
    await fireEvent.click(button(1));

    expect(dialog()?.textContent).toContain('Sign out this session?');
    expect(dialog()?.textContent).toContain(
      'Session phone will need to sign in again.',
    );
    expect(signOutSession).not.toHaveBeenCalled();
  });

  // Deleting its own row would leave this browser holding cookies for a
  // session that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does and goes home', async () => {
    signOut.mockReturnValueOnce(held());

    await signOutLine(0);

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOutSession).not.toHaveBeenCalled();
    expect(button(0).textContent?.trim()).toBe('Signing out…');
  });

  // Before the server answers, so it cannot be pressed again while the page
  // loads again.
  it('takes another session off the list as soon as it is signed out', async () => {
    signOutSession.mockReturnValueOnce(held());

    await signOutLine(1);

    expect(signOutSession).toHaveBeenCalledWith('phone-0000');
    expect(list.querySelectorAll(':scope > li')).toHaveLength(1);
    expect(list.textContent).not.toContain('phone');
  });

  it('puts it back when the server refuses', async () => {
    signOutSession.mockResolvedValueOnce({ error: 'Nope.' });

    await signOutLine(1);

    expect((await screen.findByRole('alert')).textContent).toContain('Nope.');
    expect(list.textContent).toContain('phone');
  });
});

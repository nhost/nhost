// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { AccountSession } from '@/app/account/actions';
import SessionList from '@/app/account/SessionList.vue';
import { formatSessionTime } from '@/app/account/sessions';
import ToastProvider from '@/components/ToastProvider.vue';
import { click, type Mounted, mountAt, submit } from '@/test/mount';

const refresh = vi.hoisted(() => vi.fn());
const signOutSession = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/account/actions', () => ({ signOutSession }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

const sessions: AccountSession[] = [
  { id: 'laptop-000', createdAt: '2026-10-26T12:24:00Z', current: true },
  { id: 'phone-0000', createdAt: '2026-10-20T16:12:00Z', current: false },
];

let mounted: Mounted;

const lines = () => mounted.el.querySelectorAll('li');

const button = (row: number): HTMLButtonElement =>
  lines()[row]?.querySelector('button') as HTMLButtonElement;

const dialog = (): HTMLDialogElement | null =>
  mounted.el.querySelector('dialog[open]');

// The line's button only asks; the dialog's is the one that signs out.
async function signOutLine(row: number): Promise<void> {
  await click(button(row));
  await submit(dialog()?.querySelector('form'));
}

describe('session list', () => {
  beforeEach(async () => {
    refresh.mockReset();
    signOutSession.mockReset();
    signOut.mockReset();
    mounted = await mountAt(
      () => h(ToastProvider, () => h('ul', h(SessionList, { sessions }))),
      '/account',
    );
  });

  it('shows each session by its id and when it signed in, nothing more', () => {
    expect(lines()[1]?.querySelector('p')?.textContent).toBe(
      `phoneSigned in ${formatSessionTime('2026-10-20T16:12:00Z')}`,
    );
  });

  it('asks before signing out another session, naming it', async () => {
    await click(button(1));

    expect(dialog()?.textContent).toContain('Sign out this session?');
    expect(dialog()?.textContent).toContain(
      'Session phone will need to sign in again.',
    );
    expect(signOutSession).not.toHaveBeenCalled();
  });

  // Deleting its own row would leave this browser holding a stored session
  // that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does', async () => {
    signOut.mockReturnValueOnce(new Promise(() => undefined));

    await signOutLine(0);

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOutSession).not.toHaveBeenCalled();
    expect(button(0).textContent?.trim()).toBe('Signing out…');
  });

  // Before the backend answers, so it cannot be pressed again while the list
  // loads again.
  it('takes another session off the list as soon as it is signed out', async () => {
    signOutSession.mockReturnValueOnce(new Promise(() => undefined));

    await signOutLine(1);

    expect(lines()).toHaveLength(1);
    expect(mounted.el.textContent).not.toContain('phone');
  });

  it('loads the list again once another session is signed out', async () => {
    signOutSession.mockResolvedValueOnce({ success: true });

    await signOutLine(1);

    expect(signOutSession).toHaveBeenCalledWith('phone-0000');
    expect(refresh).toHaveBeenCalled();
  });
});

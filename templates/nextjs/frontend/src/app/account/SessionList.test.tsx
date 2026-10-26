// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionList from '@/app/account/SessionList';
import { formatSessionTime, type SessionSummary } from '@/app/account/sessions';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOutSession = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ signOutSession }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const sessions: SessionSummary[] = [
  {
    id: 'laptop-000',
    device: 'Chrome - macOS',
    lastActive: '2026-10-26T12:24:00Z',
    current: true,
  },
  {
    id: 'phone-0000',
    device: 'Safari - iOS',
    place: 'Stockholm, 198.51.100.7',
    lastActive: '2026-10-20T16:12:00Z',
    current: false,
  },
];

let container: HTMLElement;
let root: Root;

const button = (row: number): HTMLButtonElement =>
  container
    .querySelectorAll('li')
    [row].querySelector('button') as HTMLButtonElement;

describe('session list', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOutSession.mockReset();
    signOut.mockReset();
    container = document.body.appendChild(document.createElement('ul'));
    root = createRoot(container);
    await act(async () => root.render(<SessionList sessions={sessions} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The browser's own zone, here the one the tests run in, once hydrated.
  it('reads what a session is on one line, and where and when on the next', () => {
    const lines = [
      ...container.querySelectorAll('li')[1].querySelectorAll('p'),
    ];

    expect(
      [...lines[0].querySelectorAll('span')].map((part) => part.textContent),
    ).toEqual(['phone', 'Safari - iOS']);
    expect(lines[1].textContent).toBe(
      `Stockholm, 198.51.100.7, ${formatSessionTime('2026-10-20T16:12:00Z')}`,
    );
  });

  it('shows the start of the id, and the whole of it on hover', () => {
    const chip = container.querySelectorAll('li')[1].querySelector('span');

    expect(chip?.textContent).toBe('phone');
    expect(chip?.title).toBe('phone-0000');
  });

  it('gives only the time when where is not known', () => {
    const lines = container.querySelectorAll('li')[0].querySelectorAll('p');

    expect(lines[1].textContent).toBe(
      formatSessionTime('2026-10-26T12:24:00Z'),
    );
  });

  it('marks this session', () => {
    expect(container.querySelectorAll('li')[0].textContent).toContain(
      'This session',
    );
  });

  // Deleting its own row would leave this browser holding cookies for a
  // session that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does and goes home', async () => {
    signOut.mockResolvedValueOnce({});

    await act(async () => button(0).click());

    expect(signOut).toHaveBeenCalledWith();
    expect(signOutSession).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('says why when this device could not be signed out', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
    });

    await act(async () => button(0).click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Could not reach the server. You are still signed in.',
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('signs out another session and reads the list again', async () => {
    signOutSession.mockResolvedValueOnce({ success: true });

    await act(async () => button(1).click());

    expect(signOutSession).toHaveBeenCalledWith('phone-0000');
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('says why when the session could not be signed out', async () => {
    signOutSession.mockResolvedValueOnce({
      error: 'That session is not on this account.',
    });

    await act(async () => button(1).click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'That session is not on this account.',
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

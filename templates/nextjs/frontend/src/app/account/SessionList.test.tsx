// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionList from '@/app/account/SessionList';
import { formatSessionTime, type SessionSummary } from '@/app/account/sessions';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const signOutSession = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ signOutSession }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const sessions: SessionSummary[] = [
  {
    id: 'laptop-000',
    details: 'Chrome - macOS',
    lastActive: '2026-10-26T12:24:00Z',
    current: true,
  },
  {
    id: 'phone-0000',
    details: 'Safari - iOS, Stockholm, 198.51.100.7',
    lastActive: '2026-10-20T16:12:00Z',
    current: false,
  },
];

let container: HTMLElement;
let root: Root;

const buttons = (): HTMLButtonElement[] => [
  ...container.querySelectorAll('button'),
];

describe('session list', () => {
  beforeEach(async () => {
    router.refresh.mockReset();
    signOutSession.mockReset();
    container = document.body.appendChild(document.createElement('ul'));
    root = createRoot(container);
    await act(async () => root.render(<SessionList sessions={sessions} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The browser's own zone, here the one the tests run in, once hydrated.
  it('reads as one line per session', () => {
    expect(container.querySelectorAll('li')[1].textContent).toBe(
      `Safari - iOS, Stockholm, 198.51.100.7 · Last active ${formatSessionTime('2026-10-20T16:12:00Z')}Sign out`,
    );
  });

  it('marks this device and offers no way to sign it out here', () => {
    const rows = container.querySelectorAll('li');

    expect(rows[0].textContent).toContain('This device');
    expect(rows[0].querySelector('button')).toBeNull();
    expect(buttons()).toHaveLength(1);
  });

  it('signs out another session and reads the list again', async () => {
    signOutSession.mockResolvedValueOnce({ success: true });

    await act(async () => buttons()[0].click());

    expect(signOutSession).toHaveBeenCalledWith('phone-0000');
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('says why when the session could not be signed out', async () => {
    signOutSession.mockResolvedValueOnce({
      error: 'That session is not on this account.',
    });

    await act(async () => buttons()[0].click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'That session is not on this account.',
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

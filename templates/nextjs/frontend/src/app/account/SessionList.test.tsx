// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionList from '@/app/account/SessionList';
import { formatSessionTime, type SessionSummary } from '@/app/account/sessions';
import ToastProvider from '@/components/Toast';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const signOutSession = vi.hoisted(() => vi.fn());
const signOutAndGoHome = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ signOutSession }));
vi.mock('@/lib/nhost/actions', () => ({ signOutAndGoHome }));

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
    release = () => resolve({});
  });

describe('session list', () => {
  beforeEach(async () => {
    router.push.mockReset();
    router.refresh.mockReset();
    signOutSession.mockReset();
    signOutAndGoHome.mockReset();
    container = document.body.appendChild(document.createElement('ul'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ToastProvider>
          <SessionList sessions={sessions} />
        </ToastProvider>,
      ),
    );
  });

  afterEach(async () => {
    await act(async () => release());
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

  it('asks before signing out another session, naming it', async () => {
    await act(async () => button(1).click());

    expect(dialog()?.textContent).toContain('Sign out this session?');
    expect(dialog()?.textContent).toContain(
      'Safari - iOS, Stockholm, 198.51.100.7 will need to sign in again.',
    );
    expect(signOutSession).not.toHaveBeenCalled();
  });

  // Deleting its own row would leave this browser holding cookies for a
  // session that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does and goes home', async () => {
    signOutAndGoHome.mockReturnValueOnce(held());

    await signOutLine(0);

    expect(signOutAndGoHome).toHaveBeenCalledOnce();
    expect(signOutSession).not.toHaveBeenCalled();
    expect(button(0).textContent).toBe('Signing out…');
  });

  // Before the server answers, so it cannot be pressed again while the page
  // is read again.
  it('takes another session off the list as soon as it is signed out', async () => {
    signOutSession.mockReturnValueOnce(new Promise(() => undefined));

    await signOutLine(1);

    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.textContent).not.toContain('Safari - iOS');
  });
});

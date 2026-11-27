// @vitest-environment happy-dom
import type { StoredSession } from '@nhost/nhost-js/session';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthProvider, { useSession } from '@/lib/nhost/AuthProvider';
import type { SessionCallbacks } from '@/lib/nhost/watchSession';

const watch = vi.hoisted(() => ({
  callbacks: null as SessionCallbacks | null,
  checkRevoked: vi.fn(async () => undefined),
  stop: vi.fn(),
}));

vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: (callbacks: SessionCallbacks) => {
    watch.callbacks = callbacks;
    return { checkRevoked: watch.checkRevoked, stop: watch.stop };
  },
}));

vi.mock('@/lib/nhost/client', () => ({
  nhost: { getUserSession: () => null },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function Email() {
  return <p>{useSession()?.user?.email ?? 'signed out'}</p>;
}

let container: HTMLElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(async () => {
  watch.checkRevoked.mockClear();
  watch.stop.mockClear();
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
  router = createMemoryRouter(
    [
      {
        element: (
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        ),
        children: [
          { path: '/', element: <Email /> },
          { path: '/other', element: <Email /> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('AuthProvider', () => {
  // Startup has just checked the page the app opened on.
  it('asks whether the session was revoked on every later navigation', async () => {
    expect(watch.checkRevoked).not.toHaveBeenCalled();

    await act(() => router.navigate('/other'));
    await act(() => router.navigate('/'));

    expect(watch.checkRevoked).toHaveBeenCalledTimes(2);
  });

  it('shows the session as the watcher reports it', async () => {
    expect(container.textContent).toBe('signed out');

    await act(async () =>
      watch.callbacks?.onSession({
        user: { email: 'ada@example.com' },
      } as StoredSession),
    );

    expect(container.textContent).toBe('ada@example.com');
  });

  it('stops watching when it unmounts', () => {
    act(() => root.unmount());

    expect(watch.stop).toHaveBeenCalled();
    root = createRoot(container);
  });
});

// @vitest-environment happy-dom
import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionGuard from '@/components/SessionGuard';
import { useRefresh } from '@/components/useRefresh';
import AuthProvider from '@/lib/nhost/AuthProvider';
import { nhost } from '@/lib/nhost/client';

vi.mock('@/lib/nhost/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/client')>()),
  checkSession: async () => 'live',
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const MARKER = 'nhostPasswordReset';
const RESET_PAGE = '/auth/password/reset';

const session = JSON.stringify({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshTokenId: 'refresh-token-id',
  decodedToken: { exp: Date.now() + 60 * 60 * 1000 },
  user: { id: 'user-id' },
});

const rendered: string[] = [];
let refresh: VoidFunction = () => undefined;

function Page({ name }: { name: string }) {
  rendered.push(name);
  refresh = useRefresh();
  return <p>{name}</p>;
}

let container: HTMLElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

async function open(path: string, strict = false): Promise<void> {
  router = createMemoryRouter(
    [
      {
        element: (
          <AuthProvider>
            <SessionGuard>
              <Outlet />
            </SessionGuard>
          </AuthProvider>
        ),
        children: [
          { path: '/', element: <Page name="home" /> },
          { path: '/account', element: <Page name="account" /> },
          { path: '/signin', element: <Page name="signin" /> },
          { path: '/auth/:method', element: <Page name="method" /> },
          { path: RESET_PAGE, element: <Page name="reset" /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const app = <RouterProvider router={router} />;
  await act(async () =>
    root.render(strict ? <StrictMode>{app}</StrictMode> : app),
  );
}

const at = (): string =>
  `${router.state.location.pathname}${router.state.location.search}`;

// What another tab's write looks like from this one.
async function otherTabWrites(
  key: string,
  newValue: string | null,
): Promise<void> {
  if (newValue === null) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, newValue);
  }
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key,
        newValue,
        storageArea: localStorage,
      }),
    );
  });
}

beforeEach(() => {
  localStorage.clear();
  rendered.length = 0;
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SessionGuard', () => {
  it('never paints a protected page for a signed-out visitor', async () => {
    await open('/account');

    expect(at()).toBe('/signin?next=%2Faccount');
    expect(rendered).not.toContain('account');
  });

  // Whatever ends a session in this tab navigates on its own, as signing out
  // does; a password change shows its result in place.
  it('stays put when this tab clears the session', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');

    await act(async () => nhost.clearSession());

    expect(at()).toBe('/account');
  });

  it('follows a sign-out in another tab', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');

    await otherTabWrites(DEFAULT_SESSION_KEY, null);

    expect(at()).toBe('/signin?next=%2Faccount');
  });

  it('confines this tab when a reset link signs another one in', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');

    await otherTabWrites(MARKER, RESET_PAGE);

    expect(at()).toBe(RESET_PAGE);
  });

  it('ignores a reset marker left behind without a session', async () => {
    localStorage.setItem(MARKER, RESET_PAGE);
    await open('/');

    expect(at()).toBe('/');
  });

  it('runs again on useRefresh()', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');
    localStorage.removeItem(DEFAULT_SESSION_KEY);

    await act(async () => refresh());

    expect(at()).toBe('/signin?next=%2Faccount');
  });

  it('remembers the way in under StrictMode', async () => {
    await open('/auth/otp', true);

    expect(localStorage.getItem('nhostSignInAttempt')).toContain('/auth/otp');

    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await act(() => router.navigate('/account'));

    expect(at()).toBe('/account');
    expect(localStorage.getItem('nhostLastSignIn')).toContain('/auth/otp');
    expect(localStorage.getItem('nhostSignInAttempt')).toBeNull();
  });
});

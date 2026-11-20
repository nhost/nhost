// @vitest-environment happy-dom
import { DEFAULT_SESSION_KEY } from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type Router,
  RouterView,
} from 'vue-router';
import { useRefresh } from '@/components/useRefresh';
import { createAuth } from '@/lib/nhost/auth';
import { nhost } from '@/lib/nhost/client';
import { guardRoutes } from '@/sessionGuard';
import { mountAt, settle } from '@/test/mount';

vi.mock('@/lib/nhost/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/nhost/client')>()),
  checkSession: async () => 'live',
}));

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

const page = (name: string) =>
  defineComponent(() => {
    rendered.push(name);
    refresh = useRefresh();
    return () => h('p', name);
  });

let router: Router;

async function open(path: string): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page('home') },
      { path: '/account', component: page('account') },
      { path: '/signin', component: page('signin') },
      { path: '/auth/:method', component: page('method') },
      { path: RESET_PAGE, component: page('reset') },
    ],
  });
  const recheck = guardRoutes(router);
  await router.push(path);
  await mountAt(() => h(RouterView), path, {
    router,
    plugins: [createAuth({ router, recheck })],
  });
}

const at = (): string => router.currentRoute.value.fullPath;

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
  window.dispatchEvent(
    new StorageEvent('storage', { key, newValue, storageArea: localStorage }),
  );
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  rendered.length = 0;
});

describe('guardRoutes', () => {
  it('never renders a protected page for a signed-out visitor', async () => {
    await open('/account');

    expect(at()).toBe('/signin?next=/account');
    expect(rendered).not.toContain('account');
  });

  // Whatever ends a session in this tab navigates on its own, as signing out
  // does; a password change shows its result in place.
  it('stays put when this tab clears the session', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');

    nhost.clearSession();
    await settle();

    expect(at()).toBe('/account');
  });

  it('follows a sign-out in another tab', async () => {
    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await open('/account');

    await otherTabWrites(DEFAULT_SESSION_KEY, null);

    expect(at()).toBe('/signin?next=/account');
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

    refresh();
    await settle();

    expect(at()).toBe('/signin?next=/account');
  });

  it('remembers the way in', async () => {
    await open('/auth/otp');

    expect(localStorage.getItem('nhostSignInAttempt')).toContain('/auth/otp');

    localStorage.setItem(DEFAULT_SESSION_KEY, session);
    await router.push('/account');

    expect(at()).toBe('/account');
    expect(localStorage.getItem('nhostLastSignIn')).toContain('/auth/otp');
    expect(localStorage.getItem('nhostSignInAttempt')).toBeNull();
  });
});

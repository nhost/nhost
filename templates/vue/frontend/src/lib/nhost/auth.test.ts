// @vitest-environment happy-dom
import type { StoredSession } from '@nhost/nhost-js/session';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type Router,
  RouterView,
} from 'vue-router';
import { createAuth, useSession } from '@/lib/nhost/auth';
import type { SessionCallbacks } from '@/lib/nhost/watchSession';
import { type Mounted, mountAt, settle } from '@/test/mount';

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

const Email = defineComponent(() => {
  const session = useSession();
  return () => h('p', session.value?.user?.email ?? 'signed out');
});

let router: Router;
let mounted: Mounted;

beforeEach(async () => {
  watch.checkRevoked.mockClear();
  watch.stop.mockClear();
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Email },
      { path: '/other', component: Email },
    ],
  });
  mounted = await mountAt(() => h(RouterView), '/', {
    router,
    plugins: [createAuth({ router, recheck: () => undefined })],
  });
});

describe('createAuth', () => {
  // Startup has just checked the page the app opened on.
  it('asks whether the session was revoked on every later navigation', async () => {
    expect(watch.checkRevoked).not.toHaveBeenCalled();

    await router.push('/other');
    await router.push('/');

    expect(watch.checkRevoked).toHaveBeenCalledTimes(2);
  });

  it('shows the session as the watcher reports it', async () => {
    expect(mounted.el.textContent).toBe('signed out');

    watch.callbacks?.onSession({
      user: { email: 'ada@example.com' },
    } as StoredSession);
    await settle();

    expect(mounted.el.textContent).toBe('ada@example.com');
  });

  it('stops watching when the app unmounts', () => {
    mounted.unmount();

    expect(watch.stop).toHaveBeenCalled();
  });
});

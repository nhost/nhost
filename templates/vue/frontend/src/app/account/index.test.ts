// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type Router,
  RouterView,
} from 'vue-router';
import Account from '@/app/account/index.vue';
import { useRefresh } from '@/components/useRefresh';
import { createAuth } from '@/lib/nhost/auth';
import { type Mounted, mountAt, settle } from '@/test/mount';

const getVerifiedUser = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({
  getVerifiedUser,
  nhost: { getUserSession: () => null, sessionStorage: { remove } },
}));

vi.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({ checkRevoked: async () => undefined, stop: vi.fn() }),
}));

// A registry of made-up methods, so this test names no real one and survives
// any of them being deleted: one with a setting on the account page, one with
// nothing to configure.
vi.mock('@/app/signin/methods', async () => {
  const { h } = await import('vue');
  const setting = (label: string) => ({
    props: ['user'],
    setup: (props: { user: User }) => () =>
      h('li', `${label} for ${props.user.id}`),
  });
  return {
    methods: [
      {
        href: '/auth/configurable',
        title: 'Configurable',
        description: '',
        account: { thing: setting('Setting') },
      },
      { href: '/auth/plain', title: 'Plain method', description: '' },
    ],
    buttonSettings: [setting('Button setting')],
  };
});

const user: User = {
  id: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'Ada',
  avatarUrl: 'https://avatars.example/ada',
  roles: ['user', 'me'],
  defaultRole: 'user',
  locale: 'en',
  isAnonymous: false,
  metadata: {},
  phoneNumberVerified: false,
  createdAt: '2026-10-13T16:00:00Z',
};

let refresh: VoidFunction = () => undefined;

const AccountWithRefresh = defineComponent(() => {
  refresh = useRefresh();
  return () => h(Account);
});

let router: Router;
let mounted: Mounted;

async function open(): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/account', component: AccountWithRefresh },
      { path: '/signin', component: { render: () => h('p', 'sign in') } },
    ],
  });
  await router.push('/account');
  mounted = await mountAt(() => h(RouterView), '/account', {
    router,
    plugins: [createAuth({ router, recheck: () => undefined })],
  });
}

const at = (): string => router.currentRoute.value.fullPath;

describe('account page', () => {
  beforeEach(() => {
    getVerifiedUser.mockReset();
    remove.mockReset();
  });

  it('renders the settings each sign-in method declares, given the user', async () => {
    getVerifiedUser.mockResolvedValue({ user });

    await open();

    expect(mounted.el.innerHTML).toContain(`<li>Setting for ${user.id}</li>`);
    expect(mounted.el.innerHTML).toContain(
      `<li>Button setting for ${user.id}</li>`,
    );
    expect(mounted.el.textContent).toContain(
      'Plain method also signs in to this account',
    );
  });

  // A stored session anyone could have written gets this far; the auth
  // service is what turns it down.
  it('clears a session the auth service refuses and sends the visitor to sign in', async () => {
    getVerifiedUser.mockResolvedValue({ user: null, reason: 'rejected' });

    await open();

    expect(remove).toHaveBeenCalled();
    expect(at()).toBe('/signin?next=/account');
  });

  // Sent to sign in with the session kept, the visitor would come straight
  // back, for as long as the outage lasts.
  it('shows an error and stays when the auth service cannot answer', async () => {
    getVerifiedUser.mockResolvedValue({ user: null, reason: 'unavailable' });

    await open();

    expect(remove).not.toHaveBeenCalled();
    expect(at()).toBe('/account');
    expect(mounted.el.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load your account',
    );
  });

  it('keeps the account on screen when a reload comes back empty', async () => {
    getVerifiedUser.mockResolvedValueOnce({ user });
    await open();

    getVerifiedUser.mockResolvedValueOnce({ user: null, reason: 'rejected' });
    refresh();
    await settle();

    expect(getVerifiedUser).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalled();
    expect(at()).toBe('/account');
    expect(mounted.el.textContent).toContain(user.email);
  });
});

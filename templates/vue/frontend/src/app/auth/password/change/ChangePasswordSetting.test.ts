// @vitest-environment happy-dom
import type { User } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, onMounted, ref } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type Router,
  RouterView,
  useRouter,
} from 'vue-router';
import AccountLayout from '@/app/account/_parent.vue';
import ChangePasswordSetting from '@/app/auth/password/change/ChangePasswordSetting.vue';
import SettingsList from '@/components/SettingsList.vue';
import { click, type Mounted, mountAt, settle, typeIn } from '@/test/mount';

const changePassword = vi.hoisted(() =>
  vi.fn<
    () => Promise<{ error?: string; success?: boolean; signedIn?: boolean }>
  >(),
);

vi.mock('@/app/auth/password/change/actions', () => ({ changePassword }));
vi.mock('@/components/useRefresh', () => ({
  useRefresh: () => () => undefined,
}));
vi.mock('@/lib/nhost/client', () => ({
  nhost: { sessionStorage: { remove: () => undefined } },
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  activeMfaType: '',
} as User;

// What the account page renders for a visitor it finds signed out.
const RedirectToSignIn = defineComponent(() => {
  const router = useRouter();
  onMounted(() => void router.replace('/signin?next=%2Faccount'));
  return () => null;
});

const redirecting = ref(false);
let mounted: Mounted;
let router: Router;

async function render(account: User): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/signin', component: { render: () => h('p', 'sign in') } },
      {
        path: '/account',
        component: AccountLayout,
        children: [
          {
            path: '',
            component: {
              render: () =>
                redirecting.value
                  ? h(RedirectToSignIn)
                  : h(SettingsList, () =>
                      h(ChangePasswordSetting, { user: account }),
                    ),
            },
          },
        ],
      },
    ],
  });
  await router.push('/account');
  mounted = await mountAt(() => h(RouterView), '/account', { router });
}

const row = (): HTMLButtonElement | null =>
  mounted.el.querySelector('button[aria-haspopup="dialog"]');

const dialog = (): HTMLDialogElement | null =>
  mounted.el.querySelector('dialog');

async function submit(password: string): Promise<void> {
  await click(row());
  for (const input of mounted.el.querySelectorAll('input')) {
    await typeIn(input, password);
  }
  mounted.el
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

describe('change password row, through a change', () => {
  beforeEach(() => {
    changePassword.mockReset();
    redirecting.value = false;
  });

  // Signing back in takes a code from the authenticator app as well, which
  // the form asks for.
  it('keeps a two-factor account signed in, with a code to sign back in', async () => {
    await render({ ...user, activeMfaType: 'totp' });
    await click(row());

    expect(dialog()?.textContent).toContain(
      "Your other devices will be signed out. You'll stay signed in here.",
    );
    expect(dialog()?.textContent).toContain('Authenticator code');
  });

  it('keeps the changed card when the page comes back as a redirect', async () => {
    changePassword.mockResolvedValue({ success: true, signedIn: false });
    await render(user);

    await submit('a new password');

    expect(mounted.el.textContent).toContain('Password changed');
    expect(mounted.el.textContent).toContain('signed you out everywhere');

    redirecting.value = true;
    await settle();

    expect(mounted.el.textContent).toContain('Password changed');
    expect(router.currentRoute.value.path).toBe('/account');
  });
});

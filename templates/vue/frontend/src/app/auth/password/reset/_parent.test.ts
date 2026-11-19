// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  type Router,
  RouterView,
} from 'vue-router';
import ResetPasswordLayout from '@/app/auth/password/reset/_parent.vue';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm.vue';
import {
  buttonIn,
  click,
  type Mounted,
  mountAt,
  settle,
  typeIn,
} from '@/test/mount';

const setNewPassword = vi.hoisted(() =>
  vi.fn<() => Promise<{ error?: string; success?: boolean }>>(),
);

const signOut = vi.hoisted(() => vi.fn<() => Promise<{ error?: string }>>());

vi.mock('@/app/auth/password/actions', () => ({ setNewPassword }));
vi.mock('@/lib/nhost/actions', () => ({ signOut }));

// What the page renders: the form, or, once the change has cleared the
// session, the expired-link card.
const expired = ref(false);
let mounted: Mounted;
let router: Router;

async function render(): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => h('p', 'home') } },
      {
        path: '/auth/password/reset',
        component: ResetPasswordLayout,
        children: [
          {
            path: '',
            component: {
              render: () =>
                expired.value
                  ? h('p', 'This link no longer works')
                  : h(ResetPasswordForm),
            },
          },
        ],
      },
    ],
  });
  await router.push('/auth/password/reset');
  mounted = await mountAt(() => h(RouterView), '/auth/password/reset', {
    router,
  });
}

async function submit(password: string): Promise<void> {
  for (const input of mounted.el.querySelectorAll('input')) {
    await typeIn(input, password);
  }
  await click(mounted.el.querySelector('button'));
}

describe('password reset layout, through a change', () => {
  beforeEach(async () => {
    setNewPassword.mockReset();
    signOut.mockReset();
    expired.value = false;
  });

  it('keeps the changed card when the page comes back without a session', async () => {
    setNewPassword.mockResolvedValue({ success: true });
    await render();

    await submit('a new password');

    expect(mounted.el.textContent).toContain('Password changed');

    expired.value = true;
    await settle();

    expect(mounted.el.textContent).toContain('Password changed');
    expect(mounted.el.textContent).not.toContain('This link no longer works');
  });

  // The guard keeps a reset link's session on this page until a password is
  // saved, so this is the one way off it without one.
  it('signs out and goes home on cancel', async () => {
    signOut.mockResolvedValue({});
    await render();

    await click(buttonIn(mounted.el, 'Cancel'));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(setNewPassword).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/');
  });
});

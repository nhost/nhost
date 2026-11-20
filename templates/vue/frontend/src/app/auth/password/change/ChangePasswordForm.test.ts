// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm.vue';
import ReplacePageLayout from '@/components/ReplacePageLayout.vue';
import { inputFor, type Mounted, mountAt, submit, typeIn } from '@/test/mount';

const changePassword = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/password/change/actions', () => ({ changePassword }));
vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/lib/nhost/client', () => ({
  nhost: { sessionStorage: { remove } },
}));

let mounted: Mounted;

async function render(needsCode = false): Promise<void> {
  mounted = await mountAt(
    () => h(ReplacePageLayout, () => h(ChangePasswordForm, { needsCode })),
    '/account',
  );
}

const type = (label: string, value: string) =>
  typeIn(inputFor(mounted.el, label), value);

const change = (): HTMLButtonElement | null =>
  mounted.el.querySelector('button[type="submit"]');

describe('change password form', () => {
  beforeEach(async () => {
    changePassword.mockReset();
    refresh.mockReset();
    remove.mockReset();
    await render();
  });

  // The action signed this browser back in with the new password, so only
  // the other devices lost their session and the page stays.
  it('keeps the page when this device is signed back in', async () => {
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit(mounted.el.querySelector('form'));

    expect(changePassword).toHaveBeenCalledWith('correct horse', undefined);
    expect(refresh).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(mounted.el.textContent).not.toContain('Sign in again');
  });

  // The change revoked this session, so the stored copy goes, but only once
  // the card is up: the account page under it must not react to the sign-out.
  it('shows the changed card in place, then clears the session, when signing back in fails', async () => {
    let shownWhenCleared = false;
    remove.mockImplementation(() => {
      shownWhenCleared = (mounted.el.textContent ?? '').includes(
        'Password changed',
      );
    });
    changePassword.mockResolvedValueOnce({ success: true, signedIn: false });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await submit(mounted.el.querySelector('form'));

    expect(mounted.el.textContent).toContain('Password changed');
    expect(remove).toHaveBeenCalled();
    expect(shownWhenCleared).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(mounted.router.currentRoute.value.path).toBe('/account');
  });

  // Auth refuses over 50 characters, or over 72 bytes for bcrypt.
  it('will not send a password auth would refuse', async () => {
    for (const password of ['a'.repeat(51), 'é'.repeat(37)]) {
      await type('New password', password);
      await type('Confirm new password', password);
      expect(change()?.disabled).toBe(true);
    }
  });

  // Two-factor: signing back in takes a current code as well.
  it('asks a two-factor account for a code and sends it along', async () => {
    mounted.unmount();
    await render(true);
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    expect(change()?.disabled).toBe(true);

    await type('Authenticator code', '123456');
    expect(change()?.disabled).toBe(false);

    await submit(mounted.el.querySelector('form'));

    expect(changePassword).toHaveBeenCalledWith('correct horse', '123456');
    expect(refresh).toHaveBeenCalledOnce();
  });
});

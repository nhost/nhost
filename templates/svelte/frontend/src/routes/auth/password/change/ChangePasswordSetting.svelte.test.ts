import type { User } from '@nhost/nhost-js/auth';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InLayout from '#lib/testing/InLayout.svelte';
import Text from '#lib/testing/Text.svelte';
import AccountLayout from '#routes/account/+layout.svelte';
import ChangePasswordSetting from './ChangePasswordSetting.svelte';

const changePassword = vi.hoisted(() => vi.fn());

vi.mock('./actions.remote.ts', () => ({ changePassword }));
vi.mock('$app/navigation', () => ({ refreshAll: () => undefined }));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  activeMfaType: '',
} as User;

const show = (shown: User) =>
  render(InLayout, {
    props: {
      layout: AccountLayout,
      page: ChangePasswordSetting,
      props: { user: shown },
    },
  });

const dialog = (): HTMLDialogElement =>
  document.querySelector('dialog') as HTMLDialogElement;

describe('change password row, through a change', () => {
  beforeEach(() => {
    changePassword.mockReset();
  });

  // Signing back in takes a code from the authenticator app as well, which
  // the form asks for.
  it('keeps a two-factor account signed in, with a code to sign back in', async () => {
    show({ ...user, activeMfaType: 'totp' });
    await fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(dialog().textContent).toContain(
      "Your other devices will be signed out. You'll stay signed in here.",
    );
    expect(dialog().textContent).toContain('Authenticator code');
  });

  // Whatever the account page shows next, the session it needed is gone.
  it('keeps the changed card when the page under it changes', async () => {
    changePassword.mockResolvedValue({ success: true, signedIn: false });
    const { rerender } = show(user);
    await fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    for (const input of dialog().querySelectorAll('input')) {
      await fireEvent.input(input, { target: { value: 'a new password' } });
    }
    await fireEvent.submit(dialog().querySelector('form') as HTMLFormElement);

    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(document.body.textContent).toContain('signed you out everywhere');

    await rerender({
      layout: AccountLayout,
      page: Text,
      props: { text: 'Signed out' },
    });

    expect(screen.queryByText('Password changed')).toBeTruthy();
  });
});

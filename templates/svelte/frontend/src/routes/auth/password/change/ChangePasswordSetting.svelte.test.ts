import type { User } from '@nhost/nhost-js/auth';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Nav from '#lib/components/Nav.svelte';
import InLayout from '#lib/testing/InLayout.svelte';
import AccountLayout from '#routes/account/+layout.svelte';
import ChangePasswordSetting from './ChangePasswordSetting.svelte';

const changePassword = vi.hoisted(() => vi.fn());

vi.mock('./actions.remote.ts', () => ({ changePassword }));
vi.mock('#lib/nhost/actions.remote.ts', () => ({ signOut: vi.fn() }));
vi.mock('$app/navigation', () => ({
  goto: () => undefined,
  invalidate: () => undefined,
  refreshAll: () => undefined,
}));
vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/account') },
}));
// No method asks the nav to look signed out on the account page.
vi.mock('#routes/signin/methods.ts', () => ({ methods: [] }));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  displayName: 'Ada',
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

  // The change cleared this browser's session, but nothing loads the page
  // again: the server hook would send a visitor without a session off it, card
  // and all. So the nav has to take the sign-out from the card.
  it('shows the changed card with the nav signed out when this device is', async () => {
    changePassword.mockResolvedValue({ success: true, signedIn: false });
    render(Nav, { props: { user } });
    show(user);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Your account' })).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    for (const input of dialog().querySelectorAll('input')) {
      await fireEvent.input(input, { target: { value: 'a new password' } });
    }
    await fireEvent.submit(dialog().querySelector('form') as HTMLFormElement);

    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(document.body.textContent).toContain('signed you out everywhere');
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign up' })).toBeTruthy();
  });
});

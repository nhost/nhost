import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReplacePageLayout from '#lib/components/ReplacePageLayout.svelte';
import InLayout from '#lib/testing/InLayout.svelte';
import ChangePasswordForm from './ChangePasswordForm.svelte';

const changePassword = vi.hoisted(() => vi.fn());
const refreshAll = vi.hoisted(() => vi.fn());

vi.mock('./actions.remote.ts', () => ({ changePassword }));
vi.mock('$app/navigation', () => ({ refreshAll }));

async function type(label: string, value: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

const changeButton = (): HTMLButtonElement =>
  screen.getByRole('button', { name: 'Change password' });

function show(needsCode = false): void {
  render(InLayout, {
    props: {
      layout: ReplacePageLayout,
      page: ChangePasswordForm,
      props: { needsCode },
    },
  });
}

describe('change password form', () => {
  beforeEach(() => {
    changePassword.mockReset();
    refreshAll.mockReset();
  });

  // The command signed this browser back in with the new password, so only
  // the other devices lost their session and the page stays.
  it('keeps the page when this device is signed back in', async () => {
    show();
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await fireEvent.submit(changeButton());

    expect(changePassword).toHaveBeenCalledWith({
      newPassword: 'correct horse',
      otp: undefined,
    });
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledOnce());
    expect(document.body.textContent).not.toContain('Sign in again');
  });

  // Auth refuses over 50 characters, or over 72 bytes for bcrypt.
  it('will not send a password auth would refuse', async () => {
    show();
    for (const password of ['a'.repeat(51), 'é'.repeat(37)]) {
      await type('New password', password);
      await type('Confirm new password', password);
      expect(changeButton().disabled).toBe(true);
    }
  });

  // Two-factor: signing back in takes a current code as well.
  it('asks a two-factor account for a code and sends it along', async () => {
    show(true);
    changePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    expect(changeButton().disabled).toBe(true);

    await type('Authenticator code', '123456');
    expect(changeButton().disabled).toBe(false);

    await fireEvent.submit(changeButton());

    expect(changePassword).toHaveBeenCalledWith({
      newPassword: 'correct horse',
      otp: '123456',
    });
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledOnce());
  });

  it('puts the changed card in place of the page when this device is signed out', async () => {
    show();
    changePassword.mockResolvedValueOnce({ success: true, signedIn: false });
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await fireEvent.submit(changeButton());

    expect(await screen.findByText('Password changed')).toBeTruthy();
    expect(document.body.textContent).toContain('signed you out everywhere');
  });
});

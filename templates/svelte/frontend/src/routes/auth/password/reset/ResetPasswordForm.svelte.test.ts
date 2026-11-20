import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReplacePageLayout from '#lib/components/ReplacePageLayout.svelte';
import InLayout from '#lib/testing/InLayout.svelte';
import Text from '#lib/testing/Text.svelte';
import ResetPasswordForm from './ResetPasswordForm.svelte';

const setNewPassword = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const goto = vi.hoisted(() => vi.fn());

vi.mock('../actions.remote.ts', () => ({ setNewPassword }));
vi.mock('#lib/nhost/actions.remote.ts', () => ({ signOut }));
vi.mock('$app/navigation', () => ({ goto }));

async function submit(password: string): Promise<void> {
  for (const input of document.querySelectorAll('input')) {
    await fireEvent.input(input, { target: { value: password } });
  }
  await fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

describe('password reset layout, through a change', () => {
  beforeEach(() => {
    setNewPassword.mockReset();
    signOut.mockReset();
    goto.mockReset();
  });

  it('keeps the changed card when the page comes back without a session', async () => {
    setNewPassword.mockResolvedValue({ success: true });
    const { rerender } = render(InLayout, {
      props: { layout: ReplacePageLayout, page: ResetPasswordForm },
    });

    await submit('a new password');

    expect(await screen.findByText('Password changed')).toBeTruthy();

    // What the page shows once the change has cleared the session.
    await rerender({
      layout: ReplacePageLayout,
      page: Text,
      props: { text: 'This link no longer works' },
    });

    expect(screen.queryByText('Password changed')).toBeTruthy();
    expect(screen.queryByText('This link no longer works')).toBeNull();
  });

  // The server hook keeps a reset link's session on this page until a password
  // is saved, so this is the one way off it without one.
  it('signs out and goes home on cancel', async () => {
    signOut.mockResolvedValue({});
    render(InLayout, {
      props: { layout: ReplacePageLayout, page: ResetPasswordForm },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(setNewPassword).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/', { refreshAll: true }),
    );
  });
});

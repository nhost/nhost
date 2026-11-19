import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChangeEmailForm from './ChangeEmailForm.svelte';

const actions = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('./actions.remote.ts', () => actions);

describe('change email form', () => {
  beforeEach(() => {
    actions.changeEmail.mockReset();
    actions.resendVerification.mockReset();
  });

  it('starts the change and says where the link went', async () => {
    actions.changeEmail.mockResolvedValueOnce({ success: true });
    render(ChangeEmailForm, {
      props: { email: 'user@example.com', verified: true },
    });

    await fireEvent.input(screen.getByLabelText('New email'), {
      target: { value: 'new@example.com' },
    });
    await fireEvent.submit(screen.getByRole('button', { name: 'Send link' }));

    expect(actions.changeEmail).toHaveBeenCalledWith('new@example.com');
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain(
      'confirmation link to new@example.com',
    );
    expect(status.textContent).toContain('changes when you open it');
  });
});

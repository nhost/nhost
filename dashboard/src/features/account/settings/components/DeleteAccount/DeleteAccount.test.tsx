import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import DeleteAccount from './DeleteAccount';

const EMAIL = 'jane@example.com';

vi.mock('@/hooks/useUserData', () => ({
  useUserData: () => ({ id: 'user-id', email: 'jane@example.com' }),
}));

async function openDeleteDialog(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: 'Delete account' }));

  return screen.findByRole('alertdialog');
}

function getConfirmationInput(dialog: HTMLElement) {
  return within(dialog).getByRole('textbox', { name: /to confirm/i });
}

function getDeleteAction(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: 'Delete' });
}

describe('DeleteAccount', () => {
  it('only enables Delete after typing the exact email', async () => {
    const user = new TestUserEvent();
    render(<DeleteAccount />);

    const dialog = await openDeleteDialog(user);
    expect(getDeleteAction(dialog)).toBeDisabled();

    await user.type(getConfirmationInput(dialog), 'jane@example');
    expect(getDeleteAction(dialog)).toBeDisabled();

    await user.type(getConfirmationInput(dialog), '.com');
    expect(getDeleteAction(dialog)).toBeEnabled();
  });

  it('clears the confirmation after the dialog is cancelled', async () => {
    const user = new TestUserEvent();
    render(<DeleteAccount />);

    const dialog = await openDeleteDialog(user);
    await user.type(getConfirmationInput(dialog), EMAIL);
    expect(getDeleteAction(dialog)).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    const reopenedDialog = await openDeleteDialog(user);

    expect(getConfirmationInput(reopenedDialog)).toHaveValue('');
    expect(getDeleteAction(reopenedDialog)).toBeDisabled();
  });
});

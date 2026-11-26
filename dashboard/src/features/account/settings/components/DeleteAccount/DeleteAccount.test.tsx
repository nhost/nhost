import {
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import DeleteAccount from './DeleteAccount';

async function openDeleteDialog(user: TestUserEvent) {
  await user.click(
    screen.getByRole('button', { name: 'Delete Personal Account' }),
  );

  return screen.findByRole('alertdialog');
}

function getConfirmationCheckbox(dialog: HTMLElement) {
  return within(dialog).getByRole('checkbox', {
    name: 'Confirm Delete Account',
  });
}

function getDeleteAction(dialog: HTMLElement) {
  return within(dialog).getByRole('button', { name: 'Delete' });
}

describe('DeleteAccount', () => {
  it('clears the confirmation after the dialog is cancelled', async () => {
    const user = new TestUserEvent();
    render(<DeleteAccount />);

    const dialog = await openDeleteDialog(user);
    await user.click(getConfirmationCheckbox(dialog));
    expect(getDeleteAction(dialog)).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    const reopenedDialog = await openDeleteDialog(user);

    expect(getConfirmationCheckbox(reopenedDialog)).not.toBeChecked();
    expect(getDeleteAction(reopenedDialog)).toBeDisabled();
  });
});

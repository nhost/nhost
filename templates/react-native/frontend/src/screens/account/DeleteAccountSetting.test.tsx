import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { useGoTo } from '@/lib/goTo';
import DeleteAccountSetting from '@/screens/account/DeleteAccountSetting';

const mockDeleteAccount = jest.fn();

jest.mock('@/screens/account/actions', () => ({
  deleteAccount: () => mockDeleteAccount(),
}));

function Account() {
  useGoTo();
  return <DeleteAccountSetting />;
}

// The row's button opens the dialog; the dialog's, after it, deletes.
const confirmButton = () =>
  screen.getAllByRole('button', { name: 'Delete account' })[1];

async function open(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
}

beforeEach(async () => {
  mockDeleteAccount.mockReset();
  await renderRouter(
    { index: () => <Text>home</Text>, 'account/index': Account },
    { initialUrl: '/account' },
  );
});

describe('delete account setting', () => {
  it('waits for the word to be typed', async () => {
    await open();
    expect(confirmButton()).toBeDisabled();

    await fireEvent.changeText(
      screen.getByLabelText('Type delete to confirm'),
      'delet',
    );
    expect(confirmButton()).toBeDisabled();
    await fireEvent(
      screen.getByLabelText('Type delete to confirm'),
      'submitEditing',
    );
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByLabelText('Type delete to confirm'),
      'delete',
    );
    expect(confirmButton()).toBeEnabled();
  });

  it('deletes once confirmed and goes home', async () => {
    mockDeleteAccount.mockResolvedValueOnce({ success: true });

    await open();
    await fireEvent.changeText(
      screen.getByLabelText('Type delete to confirm'),
      'delete',
    );
    await fireEvent.press(confirmButton());

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/');
  });

  it('stays and says why when the account was not deleted', async () => {
    mockDeleteAccount.mockResolvedValueOnce({
      error: 'The backend did not delete this account.',
    });

    await open();
    await fireEvent.changeText(
      screen.getByLabelText('Type delete to confirm'),
      'delete',
    );
    await fireEvent.press(confirmButton());

    expect(screen).toHavePathname('/account');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The backend did not delete this account.',
    );
  });
});

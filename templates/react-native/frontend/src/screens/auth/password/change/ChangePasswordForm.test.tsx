import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import ReplacePageLayout from '@/components/ReplacePageLayout';
import ChangePasswordForm from '@/screens/auth/password/change/ChangePasswordForm';

const mockChangePassword = jest.fn();
const mockRefresh = jest.fn();
const mockRemove = jest.fn();

jest.mock('@/screens/auth/password/change/actions', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));
jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/lib/nhost/client', () => ({
  nhost: { sessionStorage: { remove: () => mockRemove() } },
}));

const open = (needsCode = false) =>
  renderRouter(
    {
      index: () => <Text>home</Text>,
      'account/index': () => (
        <ReplacePageLayout>
          <ChangePasswordForm needsCode={needsCode} />
        </ReplacePageLayout>
      ),
    },
    { initialUrl: '/account' },
  );

async function type(label: string, value: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

const changeButton = () =>
  screen.getByRole('button', { name: 'Change password' });

beforeEach(() => {
  mockChangePassword.mockReset();
  mockRefresh.mockReset();
  mockRemove.mockReset();
});

describe('change password form', () => {
  // The action signed this device back in with the new password, so only
  // the other devices lost their session and the screen stays.
  it('keeps the screen when this device is signed back in', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await open();
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await fireEvent.press(changeButton());

    expect(mockChangePassword).toHaveBeenCalledWith('correct horse', undefined);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen.queryByText('Password changed')).toBeNull();
  });

  // The change revoked this session, so the stored copy goes, but only once
  // the card is up: the account screen under it must not react to the
  // sign-out.
  it('shows the changed card in place, then clears the session, when signing back in fails', async () => {
    let shownWhenCleared = false;
    mockRemove.mockImplementation(() => {
      shownWhenCleared = screen.queryByText('Password changed') !== null;
    });
    mockChangePassword.mockResolvedValueOnce({
      success: true,
      signedIn: false,
    });
    await open();
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    await fireEvent.press(changeButton());

    expect(screen.getByText('Password changed')).toBeOnTheScreen();
    expect(mockRemove).toHaveBeenCalled();
    expect(shownWhenCleared).toBe(true);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/account');
  });

  // Auth refuses over 50 characters, or over 72 bytes for bcrypt.
  it('will not send a password auth would refuse', async () => {
    await open();

    for (const password of ['a'.repeat(51), 'é'.repeat(37)]) {
      await type('New password', password);
      await type('Confirm new password', password);
      expect(changeButton()).toBeDisabled();
    }
    await fireEvent(
      screen.getByLabelText('Confirm new password'),
      'submitEditing',
    );
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  // Two-factor: signing back in takes a current code as well.
  it('asks a two-factor account for a code and sends it along', async () => {
    mockChangePassword.mockResolvedValueOnce({ success: true, signedIn: true });
    await open(true);
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');

    expect(changeButton()).toBeDisabled();

    await type('Authenticator code', '123456');
    expect(changeButton()).toBeEnabled();

    await fireEvent.press(changeButton());

    expect(mockChangePassword).toHaveBeenCalledWith('correct horse', '123456');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('says why the password did not change', async () => {
    mockChangePassword.mockResolvedValueOnce({
      error: 'That code did not work, so the password was not changed.',
    });
    await open(true);
    await type('New password', 'correct horse');
    await type('Confirm new password', 'correct horse');
    await type('Authenticator code', '000000');

    await fireEvent.press(changeButton());

    expect(screen.getByRole('alert')).toHaveTextContent(
      /password was not changed/,
    );
  });
});

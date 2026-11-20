import type { User } from '@nhost/nhost-js/auth';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import AccountLayout from '@/screens/account/layout';
import ChangePasswordSetting from '@/screens/auth/password/change/ChangePasswordSetting';

const mockChangePassword = jest.fn();

jest.mock('@/screens/auth/password/change/actions', () => ({
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
}));
jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => () => undefined,
}));
jest.mock('@/lib/nhost/client', () => ({
  nhost: { sessionStorage: { remove: () => undefined } },
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  activeMfaType: '',
} as unknown as User;

const open = (account: User) =>
  renderRouter(
    {
      index: () => <Text>home</Text>,
      'account/_layout': AccountLayout,
      'account/index': () => (
        <>
          <Text>Account details</Text>
          <ChangePasswordSetting user={account} />
        </>
      ),
    },
    { initialUrl: '/account' },
  );

beforeEach(() => {
  mockChangePassword.mockReset();
});

describe('change password row', () => {
  // Signing back in takes a code from the authenticator app as well, which
  // the form asks for.
  it('keeps a two-factor account signed in, with a code to sign back in', async () => {
    await open({ ...user, activeMfaType: 'totp' });

    await fireEvent.press(screen.getByRole('button', { name: 'Change' }));

    expect(
      screen.getByText(
        "Your other devices will be signed out. You'll stay signed in here.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Authenticator code')).toBeOnTheScreen();
  });

  it('warns an account without an email that this device signs out too', async () => {
    await open({ ...user, email: undefined } as unknown as User);

    await fireEvent.press(screen.getByRole('button', { name: 'Change' }));

    expect(
      screen.getByText(
        "You'll be signed out everywhere, this device included.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText('Authenticator code')).toBeNull();
  });

  // The card takes the whole screen's place, dialog and all, and stays at
  // /account for whatever renders there next.
  it('puts the changed card in place of the account screen', async () => {
    mockChangePassword.mockResolvedValueOnce({
      success: true,
      signedIn: false,
    });
    await open(user);

    await fireEvent.press(screen.getByRole('button', { name: 'Change' }));
    await fireEvent.changeText(
      screen.getByLabelText('New password'),
      'a new password',
    );
    await fireEvent.changeText(
      screen.getByLabelText('Confirm new password'),
      'a new password',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Change password' }),
    );

    expect(screen.getByText('Password changed')).toBeOnTheScreen();
    expect(screen.getByText(/signed you out everywhere/)).toBeOnTheScreen();
    expect(screen.queryByText('Account details')).toBeNull();
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/account');
  });
});

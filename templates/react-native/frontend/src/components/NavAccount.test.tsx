import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import NavAccount from '@/components/NavAccount';

// A made-up method page, so this test names no real one.
function Screen() {
  return (
    <NavAccount
      signedOutPaths={['/auth/method/finish']}
      signedIn={<Text>Account</Text>}
      signedOut={<Text>Sign in</Text>}
    />
  );
}

const routes = {
  index: Screen,
  'auth/method/finish': Screen,
  'auth/method/finish/step': Screen,
  'auth/method/finished': Screen,
};

describe('NavAccount', () => {
  it('shows the account when signed in', async () => {
    await renderRouter(routes);

    expect(screen.getByText('Account')).toBeOnTheScreen();
  });

  // A reset link signs the visitor in only so the new password can be saved;
  // until then the nav should not say they are signed in.
  it('looks signed out on a method page that asks for it', async () => {
    for (const path of ['/auth/method/finish', '/auth/method/finish/step']) {
      await renderRouter(routes, { initialUrl: path });

      expect(screen.getByText('Sign in')).toBeOnTheScreen();
      expect(screen.queryByText('Account')).toBeNull();
      await screen.unmount();
    }

    await renderRouter(routes, { initialUrl: '/auth/method/finished' });

    expect(screen.getByText('Account')).toBeOnTheScreen();
  });
});

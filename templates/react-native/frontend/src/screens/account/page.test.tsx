import type { User } from '@nhost/nhost-js/auth';
import { Stack } from 'expo-router';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { Text } from 'react-native';
import { useRefresh } from '@/components/useRefresh';
import AuthProvider from '@/lib/nhost/AuthProvider';
import type { VerifiedUser } from '@/lib/nhost/client';
import Account from '@/screens/account/page';

const mockGetVerifiedUser = jest.fn<Promise<VerifiedUser>, []>();
const mockRemove = jest.fn();

jest.mock('@/lib/nhost/client', () => ({
  getVerifiedUser: () => mockGetVerifiedUser(),
  nhost: {
    getUserSession: () => null,
    sessionStorage: { remove: () => mockRemove() },
  },
}));

jest.mock('@/lib/nhost/watchSession', () => ({
  watchSession: () => ({
    checkRevoked: async () => undefined,
    stop: () => undefined,
  }),
}));

// A registry of made-up methods, so this test names no real one and survives
// any of them being deleted: one with a setting on the account screen, one
// with nothing to configure.
jest.mock('@/screens/signin/methods', () => {
  const { Text: Label } = jest.requireActual('react-native');
  return {
    methods: [
      {
        href: '/auth/configurable',
        title: 'Configurable',
        description: '',
        account: {
          thing: ({ user }: { user: User }) => (
            <Label>Setting for {user.id}</Label>
          ),
        },
      },
      { href: '/auth/plain', title: 'Plain method', description: '' },
    ],
    buttonSettings: [
      ({ user }: { user: User }) => <Label>Button setting for {user.id}</Label>,
    ],
  };
});

const user: User = {
  id: '2c35b6f3-c4b9-48e3-978a-d4d0f1d42e24',
  email: 'user@example.com',
  emailVerified: false,
  displayName: 'Ada',
  avatarUrl: '',
  roles: ['user', 'me'],
  defaultRole: 'user',
  locale: 'en',
  isAnonymous: false,
  metadata: {},
  phoneNumberVerified: false,
  createdAt: '2026-10-13T16:00:00Z',
};

let refresh: VoidFunction = () => undefined;

function AccountWithRefresh() {
  refresh = useRefresh();
  return <Account />;
}

const routes = {
  _layout: () => (
    <AuthProvider>
      <Stack />
    </AuthProvider>
  ),
  index: () => <Text>home</Text>,
  'account/index': AccountWithRefresh,
  'signin/index': () => <Text>sign in</Text>,
};

const open = () => renderRouter(routes, { initialUrl: '/account' });

beforeEach(() => {
  mockGetVerifiedUser.mockReset();
  mockRemove.mockReset();
});

describe('account screen', () => {
  it('renders the settings each sign-in method declares, given the user', async () => {
    mockGetVerifiedUser.mockResolvedValue({ user });

    await open();

    expect(screen.getByText(`Setting for ${user.id}`)).toBeOnTheScreen();
    expect(screen.getByText(`Button setting for ${user.id}`)).toBeOnTheScreen();
    expect(
      screen.getByText(/Plain method also signs in to this account/),
    ).toBeOnTheScreen();
  });

  it('shows the profile and the email', async () => {
    mockGetVerifiedUser.mockResolvedValue({ user });

    await open();

    expect(screen.getByText('Ada')).toBeOnTheScreen();
    expect(screen.getByText(user.id)).toBeOnTheScreen();
    expect(screen.getByText('Joined Oct 13, 2026')).toBeOnTheScreen();
    expect(screen.getByText(/user@example\.com/)).toHaveTextContent(
      'user@example.com · not verified',
    );
  });

  // A stored session anyone could have written gets this far; the auth
  // service is what turns it down.
  it('clears a session the auth service refuses and sends the user to sign in', async () => {
    mockGetVerifiedUser.mockResolvedValue({ user: null, reason: 'rejected' });

    await open();

    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ next: '/account' });
  });

  // Sent to sign in with the session kept, the user would come straight
  // back, for as long as the outage lasts.
  it('shows an error and stays when the auth service cannot answer', async () => {
    mockGetVerifiedUser.mockResolvedValue({
      user: null,
      reason: 'unavailable',
    });

    await open();

    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/account');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load your account.',
    );

    mockGetVerifiedUser.mockResolvedValue({ user });
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Ada')).toBeOnTheScreen();
  });

  it('keeps the account on screen when a reload comes back empty', async () => {
    mockGetVerifiedUser.mockResolvedValueOnce({ user });
    await open();

    mockGetVerifiedUser.mockResolvedValueOnce({
      user: null,
      reason: 'rejected',
    });
    await act(async () => refresh());

    expect(mockGetVerifiedUser).toHaveBeenCalledTimes(2);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/account');
    expect(screen.getByText(/user@example\.com/)).toBeOnTheScreen();
  });
});

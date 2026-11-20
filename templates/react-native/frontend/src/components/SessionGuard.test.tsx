import { router, Stack } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { screenLayout } from '@/components/ScreenLayout';
import { useRefresh } from '@/components/useRefresh';
import { guard } from '@/guard';
import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import AuthProvider from '@/lib/nhost/AuthProvider';
import type { CheckedSession } from '@/lib/nhost/client';
import { nhost } from '@/lib/nhost/client';
import RootLayout from '@/screens/layout';
import { liveSession } from '@/test/session';

const mockCheckSession = jest.fn<Promise<CheckedSession>, []>();

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  checkSession: () => mockCheckSession(),
}));

jest.mock('@/guard', () => {
  const actual = jest.requireActual<typeof import('@/guard')>('@/guard');
  return { ...actual, guard: jest.fn(actual.guard) };
});

const MARKER = 'nhostPasswordReset';
const RESET_PAGE = '/auth/password/reset';

const rendered: string[] = [];
let refresh: VoidFunction = () => undefined;

function Page({ name }: { name: string }) {
  rendered.push(name);
  refresh = useRefresh();
  return <Text>{name}</Text>;
}

const screens = {
  index: () => <Page name="home" />,
  'account/index': () => <Page name="account" />,
  'signin/index': () => <Page name="signin" />,
  'auth/otp/index': () => <Page name="otp" />,
  'auth/password/reset/index': () => <Page name="reset" />,
};

// The app's own root layout, which runs every screen in StrictMode.
const open = (initialUrl: string) =>
  renderRouter({ _layout: RootLayout, ...screens }, { initialUrl });

const signIn = () => nhost.sessionStorage.set(liveSession());

beforeEach(() => {
  nhost.sessionStorage.remove();
  rendered.length = 0;
  mockCheckSession.mockReset();
  mockCheckSession.mockResolvedValue('live');
});

describe('SessionGuard', () => {
  it('never paints a protected screen for a signed-out user', async () => {
    await open('/account');

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ next: '/account' });
    expect(rendered).not.toContain('account');
  });

  // A failed flow comes back to the screen it started from with auth's error,
  // which has to reach the sign-in screen intact.
  it('carries the query through to sign-in', async () => {
    await open(
      '/account?tab=a+b&error=invalid-ticket&errorDescription=Bad%20link%3D%26more',
    );

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({
      next: '/account?tab=a+b',
      error: 'invalid-ticket',
      errorDescription: 'Bad link=&more',
    });
  });

  it('sends a signed-in user on from sign-in', async () => {
    signIn();
    await open('/signin?next=%2Faccount');

    expect(screen).toHavePathname('/account');
    expect(rendered).not.toContain('signin');
  });

  it('keeps a reset session on the reset screen', async () => {
    signIn();
    setDeviceItem(MARKER, RESET_PAGE);
    await open('/account');

    expect(screen).toHavePathname(RESET_PAGE);
    expect(rendered).not.toContain('account');

    await act(() => router.push('/'));

    expect(screen).toHavePathname(RESET_PAGE);
    expect(rendered).not.toContain('home');
  });

  it('ignores a reset marker left behind without a session', async () => {
    setDeviceItem(MARKER, RESET_PAGE);
    await open('/');

    expect(screen).toHavePathname('/');
  });

  // Whatever ends a session on a screen navigates on its own, as signing out
  // does; a password change shows its result in place.
  it('stays put when the session ends on the screen', async () => {
    signIn();
    await open('/account');

    await act(async () => nhost.clearSession());

    expect(screen).toHavePathname('/account');
  });

  it('runs again on useRefresh()', async () => {
    signIn();
    await open('/account');
    await act(async () => nhost.clearSession());

    await act(async () => refresh());

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ next: '/account' });
  });

  // Only the focused screen asks, so a revocation clears the stack first:
  // the account must not stay mounted under the screen in front of it.
  it('clears the stack when navigating finds the session revoked', async () => {
    signIn();
    await open('/account');
    mockCheckSession.mockResolvedValue('revoked');

    await act(() => router.push('/?from=account'));

    expect(nhost.getUserSession()).toBeNull();
    expect(screen).toHavePathname('/');
    expect(screen).toHaveSearchParams({ from: 'account' });
    expect(screen.queryByText('account')).toBeNull();
    expect(router.canGoBack()).toBe(false);
  });

  it('sends the user to sign in from a revoked protected screen', async () => {
    signIn();
    await open('/');
    mockCheckSession.mockResolvedValue('revoked');

    await act(() => router.push('/account?tab=1'));

    expect(screen).toHavePathname('/signin');
    expect(screen).toHaveSearchParams({ next: '/account?tab=1' });
    expect(screen.queryByText('account')).toBeNull();
    expect(screen.queryByText('home')).toBeNull();
  });

  it('remembers the way in under StrictMode', async () => {
    await open('/auth/otp');

    expect(getDeviceItem('nhostSignInAttempt')).toContain('/auth/otp');

    await act(async () => signIn());
    await act(() => router.push('/account'));

    expect(screen).toHavePathname('/account');
    expect(getDeviceItem('nhostLastSignIn')).toContain('/auth/otp');
    expect(getDeviceItem('nhostSignInAttempt')).toBeNull();
  });
});

describe('screenLayout', () => {
  const guarded = jest.mocked(guard);

  // Outside StrictMode, which runs every memo twice.
  const routes = {
    _layout: () => (
      <AuthProvider>
        <Stack screenLayout={(props) => screenLayout(props, ['auth'])} />
      </AuthProvider>
    ),
    index: () => <Page name="home" />,
    'auth/_layout': () => (
      <Stack screenLayout={(props) => screenLayout(props)} />
    ),
    'auth/one/index': () => <Page name="one" />,
    'auth/two/index': () => <Page name="two" />,
  };

  it('guards each navigation once, nested navigators included', async () => {
    await renderRouter(routes);
    guarded.mockClear();

    await act(() => router.push('/auth/one'));

    expect(guarded).toHaveBeenCalledTimes(1);
    expect(guarded).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/auth/one' }),
    );

    guarded.mockClear();
    await act(() => router.push('/auth/two?a=1'));

    expect(guarded).toHaveBeenCalledTimes(1);
    expect(guarded).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/auth/two', search: '?a=1' }),
    );

    guarded.mockClear();
    await act(() => router.back());

    expect(guarded).toHaveBeenCalledTimes(1);
    expect(guarded).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: '/auth/one', search: '' }),
    );
  });

  it('frames each screen once', async () => {
    await renderRouter(routes, { initialUrl: '/auth/one' });

    expect(screen.getAllByRole('link', { name: 'Docs' })).toHaveLength(1);
  });
});

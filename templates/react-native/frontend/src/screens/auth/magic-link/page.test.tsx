import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import AuthLayout from '@/app/auth/_layout';
import MagicLink from '@/app/auth/magic-link/index';
import { nhost } from '@/lib/nhost/client';
import { liveSession } from '@/test/session';

const mockSignIn = jest.fn<
  Promise<unknown>,
  [{ email: string; options: { redirectTo: string } }]
>();

jest.mock('@/lib/nhost/client', () => {
  const actual = jest.requireActual('@/lib/nhost/client');
  actual.nhost.auth.signInPasswordlessEmail = (
    body: Parameters<typeof mockSignIn>[0],
  ) => mockSignIn(body);
  return { ...actual, checkSession: async () => 'live' };
});

const routes = {
  _layout: RootLayout,
  index: () => <Text>home</Text>,
  'account/index': () => <Text>account</Text>,
  'auth/_layout': AuthLayout,
  'auth/magic-link/index': MagicLink,
};

const open = (initialUrl: string) => renderRouter(routes, { initialUrl });

beforeEach(() => {
  nhost.sessionStorage.remove();
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue({});
});

describe('magic link screen', () => {
  it('sends a link back to next, and lets the visitor change the address', async () => {
    await open('/auth/magic-link?next=%2Faccount%3Ftab%3D1');

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'ada@example.com',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Send me a link' }),
    );

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn.mock.calls[0][0]).toMatchObject({
      email: 'ada@example.com',
      options: {
        redirectTo: expect.stringMatching(
          /^nhost-starter:\/\/account\?tab=1&flow=/,
        ),
      },
    });
    expect(
      screen.getByText(/on its way to ada@example\.com/),
    ).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Use a different address' }),
    );

    expect(screen.getByLabelText('Email')).toHaveDisplayValue('');
  });

  it('says why the link was not sent', async () => {
    mockSignIn.mockRejectedValue({ status: 429, message: '' });
    await open('/auth/magic-link');

    await fireEvent.changeText(
      screen.getByLabelText('Email'),
      'ada@example.com',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Send me a link' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not send the link: Too many attempts. Try again in an hour.',
    );
  });

  // The nested stack guards and frames its own screens, once each.
  it('frames the screen once, inside the nav', async () => {
    await open('/auth/magic-link');

    expect(screen.getAllByRole('link', { name: 'Docs' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Nhost' })).toHaveLength(1);
  });

  it('sends a signed-in visitor on to next', async () => {
    nhost.sessionStorage.set(liveSession());

    await open('/auth/magic-link?next=%2Faccount');

    expect(screen).toHavePathname('/account');
    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});

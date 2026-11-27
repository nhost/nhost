import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import type { ActionResult } from '@/lib/nhost/errors';
import ProviderSignIn from '@/screens/auth/oauth/ProviderSignIn';

const mockSignIn = jest.fn<Promise<ActionResult>, [string, string]>();

jest.mock('@/screens/auth/oauth/actions', () => ({
  signInWithProvider: (id: string, next: string) => mockSignIn(id, next),
}));

const open = (lastUsed: string | null = null) =>
  renderRouter(
    {
      signin: () => (
        <ProviderSignIn destination="/account?tab=1" lastUsed={lastUsed} />
      ),
    },
    { initialUrl: '/signin' },
  );

const saved = process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;

let release: VoidFunction = () => undefined;

beforeEach(() => {
  process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = 'google';
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue({});
});

afterEach(async () => {
  await act(async () => release());
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;
  } else {
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = saved;
  }
});

describe('provider sign-in', () => {
  it('offers only the providers the deployment set up', async () => {
    await open();

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Continue with GitHub' }),
    ).toBeNull();
  });

  it('signs in with the provider, back to where the visitor was going', async () => {
    await open();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Continue with Google' }),
    );

    expect(mockSignIn).toHaveBeenCalledWith('google', '/account?tab=1');
  });

  it('marks the provider the visitor last signed in with', async () => {
    await open('/auth/oauth/google');

    expect(screen.getByText('Last used')).toBeOnTheScreen();
  });

  it('opens one browser at a time', async () => {
    mockSignIn.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve({});
      }),
    );
    await open();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Continue with Google' }),
    );

    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeDisabled();
  });

  it('says why the browser did not open', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'No browser.' });
    await open();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Continue with Google' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('No browser.');
  });
});

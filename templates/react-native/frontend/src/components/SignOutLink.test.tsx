import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import { Text } from 'react-native';
import SignOutLink from '@/components/SignOutLink';
import type { signOut } from '@/lib/nhost/actions';

const mockSignOut = jest.fn<ReturnType<typeof signOut>, []>();

jest.mock('@/lib/nhost/actions', () => ({
  signOut: () => mockSignOut(),
}));

const routes = {
  index: () => <Text>home</Text>,
  page: () => (
    <Text>
      Then <SignOutLink>sign out</SignOutLink>.
    </Text>
  ),
};

const link = () => screen.getByRole('button', { name: 'sign out' });

// React holds every async action on a screen together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): ReturnType<typeof signOut> =>
  new Promise((resolve) => {
    release = () => resolve({ stillSignedIn: true });
  });

beforeEach(async () => {
  mockSignOut.mockReset();
  await renderRouter(routes, { initialUrl: '/page' });
});

afterEach(async () => {
  await act(async () => release());
});

describe('sign-out link', () => {
  it('signs out once, however often it is pressed meanwhile', async () => {
    mockSignOut.mockReturnValueOnce(held());

    await fireEvent.press(link());
    await fireEvent.press(link());

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(link()).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('goes home once signed out', async () => {
    mockSignOut.mockResolvedValueOnce({});

    await fireEvent.press(link());

    expect(screen).toHavePathname('/');
  });

  it('stays and says so when the sign-out did not reach the server', async () => {
    mockSignOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await fireEvent.press(link());

    expect(screen).toHavePathname('/page');
    expect(screen.getByRole('alert')).toHaveTextContent(
      /You are still signed in\./,
    );
  });
});

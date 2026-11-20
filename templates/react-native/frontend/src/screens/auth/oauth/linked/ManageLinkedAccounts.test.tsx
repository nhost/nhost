import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import ToastProvider from '@/components/Toast';
import type { ActionResult } from '@/lib/nhost/errors';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from '@/screens/auth/oauth/linked/ManageLinkedAccounts';

const mockRefresh = jest.fn();
const mockActions = {
  linkProvider: jest.fn<Promise<ActionResult>, [string]>(),
  unlinkProvider: jest.fn<Promise<ActionResult>, [string]>(),
};

jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/screens/auth/oauth/linked/actions', () => ({
  linkProvider: (id: string) => mockActions.linkProvider(id),
  unlinkProvider: (id: string) => mockActions.unlinkProvider(id),
}));

const providers: LinkedProvider[] = [
  {
    id: 'github',
    name: 'GitHub',
    link: { id: 'link-1', since: 'Oct 1, 2026' },
  },
  { id: 'google', name: 'Google' },
];

const open = ({ email = 'user@example.com', list = providers } = {}) =>
  renderRouter(
    {
      account: () => (
        <ToastProvider>
          <ManageLinkedAccounts
            providers={list}
            email={email}
            links={list.filter(({ link }) => link).length}
          />
        </ToastProvider>
      ),
    },
    { initialUrl: '/account' },
  );

const unlinkButtons = () => screen.queryAllByRole('button', { name: 'Unlink' });

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

// React holds every async action on a screen together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;

const pendingUntilReleased = (): Promise<ActionResult> =>
  new Promise((resolve) => {
    release = () => resolve({ error: 'released' });
  });

beforeEach(() => {
  mockRefresh.mockReset();
  mockActions.linkProvider.mockReset();
  mockActions.unlinkProvider.mockReset();
});

afterEach(async () => {
  await act(async () => release());
});

describe('manage linked accounts', () => {
  // Before the server answers, so it cannot be pressed again while the
  // screen is read again.
  it('shows the provider as not linked as soon as it is unlinked', async () => {
    mockActions.unlinkProvider.mockReturnValueOnce(pendingUntilReleased());
    await open();

    await press('Unlink');

    expect(unlinkButtons()).toHaveLength(0);
    expect(
      screen.getAllByRole('button', { name: 'Link account' }),
    ).toHaveLength(2);
  });

  // Auth links a provider again by verified email, so Unlink alone doesn't
  // cut it off.
  it('says a provider with the account email links again', async () => {
    await open();

    expect(
      screen.getByText(
        "Unlinking doesn't block a provider whose verified email is user@example.com. Signing in with it links it again.",
      ),
    ).toBeOnTheScreen();
  });

  // No email, two links: unlinking one leaves the other as the only way in.
  it('holds the last link once the other is unlinked', async () => {
    mockActions.unlinkProvider.mockReturnValueOnce(pendingUntilReleased());
    await open({
      email: '',
      list: [
        providers[0],
        { ...providers[1], link: { id: 'link-2', since: 'Oct 2, 2026' } },
      ],
    });
    for (const button of unlinkButtons()) {
      expect(button).toBeEnabled();
    }

    await act(async () => fireEvent.press(unlinkButtons()[0]));

    expect(unlinkButtons()).toHaveLength(1);
    expect(unlinkButtons()[0]).toBeDisabled();
  });

  it('reads the list again once a provider is linked', async () => {
    mockActions.linkProvider.mockResolvedValueOnce({ success: true });
    await open();

    await press('Link account');

    expect(mockActions.linkProvider).toHaveBeenCalledWith('google');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Google linked')).toBeOnTheScreen();
  });

  it('does nothing when the browser is closed', async () => {
    mockActions.linkProvider.mockResolvedValueOnce({});
    await open();

    await press('Link account');

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says why a provider could not be linked', async () => {
    mockActions.linkProvider.mockResolvedValueOnce({ error: 'No browser.' });
    await open();

    await press('Link account');

    expect(screen.getByRole('alert')).toHaveTextContent('No browser.');
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // One trip to a provider at a time: the browser opens only once.
  it('holds every button while the browser is open', async () => {
    mockActions.linkProvider.mockReturnValueOnce(pendingUntilReleased());
    await open();

    await press('Link account');

    expect(screen.getByRole('button', { name: 'Link account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unlink' })).toBeDisabled();
  });
});

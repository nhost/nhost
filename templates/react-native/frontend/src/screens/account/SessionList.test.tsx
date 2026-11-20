import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import ToastProvider from '@/components/Toast';
import type { signOut } from '@/lib/nhost/actions';
import type { AccountSession } from '@/screens/account/actions';
import SessionList from '@/screens/account/SessionList';
import { formatSessionTime } from '@/screens/account/sessions';

const mockRefresh = jest.fn();
const mockSignOutSession = jest.fn();
const mockSignOut = jest.fn<ReturnType<typeof signOut>, []>();

jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/screens/account/actions', () => ({
  signOutSession: (id: string) => mockSignOutSession(id),
}));
jest.mock('@/lib/nhost/actions', () => ({ signOut: () => mockSignOut() }));

const sessions: AccountSession[] = [
  { id: 'phone-0000', createdAt: '2026-10-26T12:24:00Z', current: true },
  { id: 'tablet-000', createdAt: '2026-10-20T16:12:00Z', current: false },
];

const lineButton = (row: number) =>
  screen.getAllByRole('button', { name: /^Sign(ing)? out/ })[row];

// The line's button only asks; the dialog's is the one that signs out.
async function signOutLine(row: number): Promise<void> {
  await fireEvent.press(lineButton(row));
  const buttons = screen.getAllByRole('button', { name: 'Sign out' });
  await fireEvent.press(buttons[buttons.length - 1]);
}

// React holds every async action on a screen together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): ReturnType<typeof signOut> =>
  new Promise((resolve) => {
    release = () => resolve({ stillSignedIn: true });
  });

beforeEach(async () => {
  mockRefresh.mockReset();
  mockSignOutSession.mockReset();
  mockSignOut.mockReset();
  await renderRouter(
    {
      account: () => (
        <ToastProvider>
          <SessionList sessions={sessions} />
        </ToastProvider>
      ),
    },
    { initialUrl: '/account' },
  );
});

afterEach(async () => {
  await act(async () => release());
});

describe('session list', () => {
  it('shows each session by its id and when it signed in', () => {
    expect(screen.getByText('table')).toBeOnTheScreen();
    expect(
      screen.getByText(
        `Signed in ${formatSessionTime('2026-10-20T16:12:00Z')}`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('This session')).toBeOnTheScreen();
  });

  it('asks before signing out another session, naming it', async () => {
    await fireEvent.press(lineButton(1));

    expect(
      screen.getByRole('heading', { name: 'Sign out this session?' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Session table will need to sign in again.'),
    ).toBeOnTheScreen();
    expect(mockSignOutSession).not.toHaveBeenCalled();
  });

  // Deleting its own row would leave this device holding a stored session
  // that is gone, so it signs out the way the nav does.
  it('signs this device out the way the nav does', async () => {
    mockSignOut.mockReturnValueOnce(held());

    await signOutLine(0);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOutSession).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Signing out…' }),
    ).toBeOnTheScreen();
  });

  // Before the backend answers, so it cannot be pressed again while the list
  // loads again.
  it('takes another session off the list as soon as it is signed out', async () => {
    mockSignOutSession.mockReturnValueOnce(new Promise(() => undefined));

    await signOutLine(1);

    expect(screen.queryByText('table')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('loads the list again once another session is signed out', async () => {
    mockSignOutSession.mockResolvedValueOnce({ success: true });

    await signOutLine(1);

    expect(mockSignOutSession).toHaveBeenCalledWith('tablet-000');
    expect(screen.getByText('Session signed out')).toBeOnTheScreen();
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('puts the session back and says why when the backend refuses', async () => {
    mockSignOutSession.mockResolvedValueOnce({
      error: 'That session is not on this account.',
    });

    await signOutLine(1);

    expect(screen.getByText('table')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That session is not on this account.',
    );
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

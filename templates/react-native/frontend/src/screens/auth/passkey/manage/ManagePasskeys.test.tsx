import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from 'expo-router/testing-library';
import ToastProvider from '@/components/Toast';
import type { Passkey } from '@/screens/auth/passkey/manage/actions';
import ManagePasskeys from '@/screens/auth/passkey/manage/ManagePasskeys';
import {
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/screens/auth/passkey/thisDevice';

const mockRefresh = jest.fn();
const mockActions = {
  beginAddPasskey: jest.fn(),
  finishAddPasskey: jest.fn(),
  removePasskey: jest.fn(),
};
const mockStartRegistration = jest.fn();

jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('@/screens/auth/passkey/manage/actions', () => ({
  beginAddPasskey: () => mockActions.beginAddPasskey(),
  finishAddPasskey: (...args: unknown[]) =>
    mockActions.finishAddPasskey(...args),
  removePasskey: (...args: unknown[]) => mockActions.removePasskey(...args),
}));
jest.mock('@/screens/auth/passkey/ceremony', () => ({
  supportsPasskeys: () => true,
  startRegistration: (...args: unknown[]) => mockStartRegistration(...args),
}));
jest.mock('expo-device', () => ({ modelName: 'Pixel 8', osName: 'Android' }));

const keys: Passkey[] = [{ id: 'k1', credentialId: 'c1', nickname: 'laptop' }];

// The dialog's state is set when it opens, so each test opens it afresh.
const open = (list: Passkey[] = keys) =>
  renderRouter(
    {
      account: () => (
        <ToastProvider>
          <ManagePasskeys keys={list} />
        </ToastProvider>
      ),
    },
    { initialUrl: '/account' },
  );

const press = (name: string) =>
  fireEvent.press(screen.getByRole('button', { name }));

const nameField = () => screen.getByLabelText('Name for a new passkey');

// React holds every async action on a screen together, so one left pending
// would hold back the next test's. Each test's is let go when it ends.
let release: VoidFunction = () => undefined;

beforeEach(() => {
  mockRefresh.mockReset();
  mockStartRegistration.mockReset();
  for (const fn of Object.values(mockActions)) {
    fn.mockReset();
  }
});

afterEach(async () => {
  await act(async () => release());
});

describe('manage passkeys', () => {
  it('starts the name as the device it is added on', async () => {
    await open();

    expect(nameField()).toHaveDisplayValue('Pixel 8 - Android');
  });

  // Added or used here before, so the device would refuse another.
  it('marks the passkey this device holds and says so before adding', async () => {
    rememberPasskey('c1');
    await open();

    expect(screen.getByText('This device')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'This device already has a passkey for your account. To add another, use another device or a security key.',
      ),
    ).toBeOnTheScreen();
    expect(nameField()).toHaveDisplayValue('');
  });

  // Options from the first server call, credential into the second, with the
  // device's step between them.
  it('runs the add ceremony and refreshes the list', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'new' };
    mockActions.beginAddPasskey.mockResolvedValueOnce({ options });
    mockStartRegistration.mockResolvedValueOnce(credential);
    mockActions.finishAddPasskey.mockResolvedValueOnce({ success: true });
    await open();

    await press('Add passkey');

    expect(mockStartRegistration).toHaveBeenCalledWith(options);
    expect(mockActions.finishAddPasskey).toHaveBeenCalledWith(
      credential,
      'Pixel 8 - Android',
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(passkeysOnThisDevice().has('new')).toBe(true);
  });

  it('says why the device refused a second passkey', async () => {
    mockActions.beginAddPasskey.mockResolvedValueOnce({ options: {} });
    mockStartRegistration.mockRejectedValueOnce({
      error: 'CredentialAlreadyExists',
      message: '',
    });
    await open();

    await press('Add passkey');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This device already has a passkey for your account. To add another, use another device or a security key.',
    );
  });

  it('says the prompt was cancelled', async () => {
    mockActions.beginAddPasskey.mockResolvedValueOnce({ options: {} });
    mockStartRegistration.mockRejectedValueOnce({
      error: 'UserCancelled',
      message: '',
    });
    await open();

    await press('Add passkey');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The passkey prompt was cancelled.',
    );
    expect(mockActions.finishAddPasskey).not.toHaveBeenCalled();
  });

  // Before the server answers, so it cannot be pressed again while the
  // screen is read again.
  it('takes the passkey off the list as soon as Remove is pressed', async () => {
    mockActions.removePasskey.mockReturnValueOnce(
      new Promise((resolve) => {
        release = () => resolve({ error: 'released' });
      }),
    );
    await open();

    await press('Remove');

    expect(screen.queryByText('laptop')).toBeNull();
  });

  it('forgets a removed passkey on this device', async () => {
    rememberPasskey('c1');
    mockActions.removePasskey.mockResolvedValueOnce({ success: true });
    await open();

    await press('Remove');

    expect(mockActions.removePasskey).toHaveBeenCalledWith('k1');
    expect(passkeysOnThisDevice().has('c1')).toBe(false);
    expect(mockRefresh).toHaveBeenCalled();
  });
});

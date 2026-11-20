import type { User } from '@nhost/nhost-js/auth';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import { SettingsList } from '@/components/Setting';
import ToastProvider from '@/components/Toast';
import MfaSetting from '@/screens/auth/password/mfa/MfaSetting';
import { totpUri } from '@/screens/auth/password/mfa/totp';

const mockActions = {
  generateMfa: jest.fn(),
  enableMfa: jest.fn(),
  disableMfa: jest.fn(),
};
const mockRefresh = jest.fn();
const mockSetString = jest.fn<Promise<boolean>, [string]>();

jest.mock('@/screens/auth/password/mfa/actions', () => ({
  generateMfa: () => mockActions.generateMfa(),
  enableMfa: (code: string) => mockActions.enableMfa(code),
  disableMfa: (code: string) => mockActions.disableMfa(code),
}));
jest.mock('@/components/useRefresh', () => ({
  useRefresh: () => mockRefresh,
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: (text: string) => mockSetString(text),
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  activeMfaType: '',
} as unknown as User;

const key = 'LBU4RFZ3L6VWIXZG';
const setup = { imageUrl: 'data:image/png;base64,qr', totpSecret: key };

const open = (active: boolean) =>
  renderRouter(
    {
      index: () => (
        <ToastProvider>
          <SettingsList>
            <MfaSetting
              user={{ ...user, activeMfaType: active ? 'totp' : '' }}
            />
          </SettingsList>
        </ToastProvider>
      ),
    },
    { initialUrl: '/' },
  );

const codeField = (label = '2. Enter the 6-digit code.') =>
  screen.queryByLabelText(label);

async function enterCode(code: string, label?: string): Promise<void> {
  const field = codeField(label);
  if (!field) {
    throw new Error('No code field');
  }
  await fireEvent.changeText(field, code);
  await fireEvent(field, 'submitEditing');
}

let openURL: jest.SpyInstance;
let canOpenURL: jest.SpyInstance;

beforeEach(() => {
  for (const action of Object.values(mockActions)) {
    action.mockReset();
  }
  mockRefresh.mockReset();
  mockSetString.mockReset();
  mockSetString.mockResolvedValue(true);
  openURL = jest.spyOn(Linking, 'openURL');
  canOpenURL = jest.spyOn(Linking, 'canOpenURL');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('two-factor row', () => {
  it('fetches a key on opening, and turns on with the code', async () => {
    mockActions.generateMfa.mockResolvedValueOnce({ setup });
    mockActions.enableMfa.mockResolvedValueOnce({ success: true });
    await open(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));

    expect(mockActions.generateMfa).toHaveBeenCalledTimes(1);
    expect(
      screen.getByLabelText('QR code for the authenticator app'),
    ).toHaveProp('source', { uri: setup.imageUrl });
    // Shown in groups of four, as authenticator apps show it.
    expect(screen.getByText('LBU4 RFZ3 L6VW IXZG')).toBeOnTheScreen();
    expect(
      screen.getByText(
        /when you sign in with your password\. Other sign-in methods and emailed links skip it\./,
      ),
    ).toBeOnTheScreen();

    await enterCode('123456');

    expect(mockActions.enableMfa).toHaveBeenCalledWith('123456');
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(codeField()).toBeNull();
    expect(screen.getAllByText('Two-factor is on').length).toBeGreaterThan(0);

    // Before the refreshed screen arrives, so opening it again offers the way
    // back rather than another setup.
    expect(screen.getByText(/On$/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeOnTheScreen();
  });

  it('opens the authenticator app on this device with the key', async () => {
    mockActions.generateMfa.mockResolvedValueOnce({ setup });
    openURL.mockResolvedValueOnce(true);
    await open(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Open in authenticator' }),
    );

    expect(openURL).toHaveBeenCalledWith(totpUri(key, user));
    expect(canOpenURL).not.toHaveBeenCalled();
    expect(mockSetString).not.toHaveBeenCalled();
  });

  // Nothing takes `otpauth://` links without an authenticator installed, and
  // the key still has to get into one somehow.
  it('copies the key when no app opens the link', async () => {
    mockActions.generateMfa.mockResolvedValueOnce({ setup });
    openURL.mockRejectedValueOnce(new Error('No app'));
    await open(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));

    await fireEvent.press(
      screen.getByRole('button', { name: 'Open in authenticator' }),
    );

    expect(mockSetString).toHaveBeenCalledWith(key);
    expect(
      screen.getAllByText('No authenticator app opened the link. Key copied')
        .length,
    ).toBeGreaterThan(0);
    expect(canOpenURL).not.toHaveBeenCalled();
  });

  it('copies the key without the spaces it is shown with', async () => {
    mockActions.generateMfa.mockResolvedValueOnce({ setup });
    await open(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Copy key' }));

    expect(mockSetString).toHaveBeenCalledWith(key);
    expect(mockActions.enableMfa).not.toHaveBeenCalled();
    expect(screen.getAllByText('Key copied').length).toBeGreaterThan(0);

    // The toast is about a key that is no longer on screen.
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(codeField()).toBeNull();
    expect(screen.queryAllByText('Key copied')).toHaveLength(0);
  });

  it('turns off with a current code, without a new key', async () => {
    mockActions.disableMfa.mockResolvedValueOnce({ success: true });
    await open(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Turn off' }));

    expect(mockActions.generateMfa).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Open in authenticator' }),
    ).toBeNull();

    await enterCode('654321', 'Code');

    expect(mockActions.disableMfa).toHaveBeenCalledWith('654321');
    expect(screen.getByRole('button', { name: 'Set up' })).toBeOnTheScreen();
  });

  it('says why the code was refused and stays open', async () => {
    mockActions.generateMfa.mockResolvedValueOnce({ setup });
    mockActions.enableMfa.mockResolvedValueOnce({
      error: 'Could not turn on two-factor: Invalid TOTP',
    });
    await open(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Set up' }));

    await enterCode('000000');

    expect(screen.getByRole('alert')).toHaveTextContent(/Invalid TOTP$/);
    expect(codeField()).toBeOnTheScreen();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

import { renderRouter, screen } from 'expo-router/testing-library';
import { SettingsList } from '@/components/Setting';
import type { listPasskeys } from '@/screens/auth/passkey/manage/actions';
import PasskeysSetting from '@/screens/auth/passkey/manage/PasskeysSetting';

const mockListPasskeys = jest.fn<ReturnType<typeof listPasskeys>, []>();

jest.mock('@/screens/auth/passkey/manage/actions', () => ({
  listPasskeys: () => mockListPasskeys(),
}));

const open = () =>
  renderRouter(
    {
      account: () => (
        <SettingsList>
          <PasskeysSetting />
        </SettingsList>
      ),
    },
    { initialUrl: '/account' },
  );

beforeEach(() => {
  mockListPasskeys.mockReset();
});

describe('passkeys setting', () => {
  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has passkeys.
  it('says it is loading until the list arrives', async () => {
    mockListPasskeys.mockReturnValueOnce(new Promise(() => undefined));

    await open();

    expect(screen.getAllByText('Loading…')[0]).toBeOnTheScreen();
    expect(screen.queryByText('None')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  it('shows the names of the passkeys it loaded', async () => {
    mockListPasskeys.mockResolvedValueOnce({
      keys: [
        { id: 'k1', credentialId: 'c1', nickname: 'laptop' },
        { id: 'k2', credentialId: 'c2', nickname: null },
      ],
    });

    await open();

    expect(screen.getByText('laptop, Passkey 2')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeOnTheScreen();
  });

  it('offers to add one when there are none', async () => {
    mockListPasskeys.mockResolvedValueOnce({ keys: [] });

    await open();

    expect(screen.getByText('None')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add' })).toBeOnTheScreen();
  });
});

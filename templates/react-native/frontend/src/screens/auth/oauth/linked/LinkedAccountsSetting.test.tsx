import type { User } from '@nhost/nhost-js/auth';
import { renderRouter, screen } from 'expo-router/testing-library';
import { SettingsList } from '@/components/Setting';
import type { listLinkedAccounts } from '@/screens/auth/oauth/linked/actions';
import LinkedAccountsSetting from '@/screens/auth/oauth/linked/LinkedAccountsSetting';

const mockListLinkedAccounts = jest.fn<
  ReturnType<typeof listLinkedAccounts>,
  []
>();

jest.mock('@/screens/auth/oauth/linked/actions', () => ({
  listLinkedAccounts: () => mockListLinkedAccounts(),
}));

const user = { id: 'user-1', email: 'user@example.com' } as User;

const open = () =>
  renderRouter(
    {
      account: () => (
        <SettingsList>
          <LinkedAccountsSetting user={user} />
        </SettingsList>
      ),
    },
    { initialUrl: '/account' },
  );

const saved = process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;

beforeEach(() => {
  process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = 'github,google';
  mockListLinkedAccounts.mockReset();
});

afterEach(() => {
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS;
  } else {
    process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS = saved;
  }
});

describe('linked accounts setting', () => {
  // Before the list arrives the row offers neither "None" nor "Add", which
  // would be wrong for an account that has links.
  it('says it is loading until the list arrives', async () => {
    mockListLinkedAccounts.mockReturnValueOnce(new Promise(() => undefined));

    await open();

    expect(screen.getAllByText('Loading…')[0]).toBeOnTheScreen();
    expect(screen.queryByText('None')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });

  it('names the providers the account is linked to', async () => {
    mockListLinkedAccounts.mockResolvedValueOnce({
      links: [
        { id: 'l1', providerId: 'github', createdAt: '2026-10-01T00:00:00Z' },
      ],
    });

    await open();

    expect(screen.getByText('GitHub')).toBeOnTheScreen();
    expect(screen.queryByText('Google')).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeOnTheScreen();
  });

  it('offers to add one when there are none', async () => {
    mockListLinkedAccounts.mockResolvedValueOnce({ links: [] });

    await open();

    expect(screen.getByText('None')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add' })).toBeOnTheScreen();
  });
});

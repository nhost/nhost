import StorageRouteTabs from '@/features/orgs/projects/storage/layout/StorageRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/storage',
  query: {
    orgSlug: 'nhost',
    appSubdomain: 'dashboard',
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/hooks/useSettingsDisabled', () => ({
  useSettingsDisabled: () => settingsDisabled.value,
}));

describe('StorageRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/storage';
    settingsDisabled.value = false;
  });

  it('renders Storage route tabs in product and settings order', () => {
    render(<StorageRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Storage section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Storage', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/storage/settings',
    );
  });

  it('marks bucket routes as the active Storage tab', () => {
    router.route =
      '/orgs/[orgSlug]/projects/[appSubdomain]/storage/bucket/[...bucketId]';

    render(<StorageRouteTabs />);

    expect(screen.getByRole('link', { name: 'Storage' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables the settings route when project settings are disabled', () => {
    settingsDisabled.value = true;

    render(<StorageRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

import AuthRouteTabs from '@/features/orgs/projects/authentication/layout/AuthRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/auth/users',
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

describe('AuthRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/auth/users';
    settingsDisabled.value = false;
  });

  it('renders Auth route tabs in product and settings order', () => {
    render(<AuthRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Auth section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Users', 'OAuth2 Clients', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/auth/settings',
    );
  });

  it('marks the active Auth route tab', () => {
    router.route =
      '/orgs/[orgSlug]/projects/[appSubdomain]/auth/oauth2-clients';

    render(<AuthRouteTabs />);

    expect(
      screen.getByRole('link', { name: 'OAuth2 Clients' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('disables the settings route when project settings are disabled', () => {
    settingsDisabled.value = true;

    render(<AuthRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

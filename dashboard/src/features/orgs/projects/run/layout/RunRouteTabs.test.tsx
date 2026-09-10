import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/run',
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

describe('RunRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/run';
    settingsDisabled.value = false;
  });

  it('renders Run route tabs in product and settings order', () => {
    render(<RunRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Run section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Services', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/run/settings',
    );
  });

  it('marks settings as active on the Run settings route', () => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/run/settings';

    render(<RunRouteTabs />);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables the settings route when project settings are disabled', () => {
    settingsDisabled.value = true;

    render(<RunRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

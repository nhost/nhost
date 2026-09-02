import FunctionsRouteTabs from '@/features/orgs/projects/serverless-functions/layout/FunctionsRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/functions',
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

describe('FunctionsRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/functions';
    settingsDisabled.value = false;
  });

  it('renders Functions route tabs in product and settings order', () => {
    render(<FunctionsRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Functions section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Functions', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/functions/settings',
    );
  });

  it('marks function detail routes as the active Functions tab', () => {
    router.route =
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[...functionSlug]';

    render(<FunctionsRouteTabs />);

    expect(screen.getByRole('link', { name: 'Functions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables the settings route when project settings are disabled', () => {
    settingsDisabled.value = true;

    render(<FunctionsRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Settings')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

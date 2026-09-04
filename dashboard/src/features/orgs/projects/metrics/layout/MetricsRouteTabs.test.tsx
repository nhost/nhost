import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const isPlatform = vi.hoisted(() => ({ value: true }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/metrics',
  query: {
    orgSlug: 'nhost',
    appSubdomain: 'dashboard',
  },
}));

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => isPlatform.value,
}));

vi.mock('@/hooks/useSettingsDisabled', () => ({
  useSettingsDisabled: () => settingsDisabled.value,
}));

describe('MetricsRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/metrics';
    settingsDisabled.value = false;
    isPlatform.value = true;
  });

  it('renders Metrics route tabs in product and settings order', () => {
    render(<MetricsRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Metrics section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Metrics', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/metrics/settings',
    );
  });

  it('marks settings as active on the Metrics settings route', () => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/metrics/settings';

    render(<MetricsRouteTabs />);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables tabs off platform', () => {
    isPlatform.value = false;

    render(<MetricsRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Metrics' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
  });
});

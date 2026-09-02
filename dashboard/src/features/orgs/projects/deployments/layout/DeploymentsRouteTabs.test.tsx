import DeploymentsRouteTabs from '@/features/orgs/projects/deployments/layout/DeploymentsRouteTabs';
import { render, screen, within } from '@/tests/testUtils';

const settingsDisabled = vi.hoisted(() => ({ value: false }));
const isPlatform = vi.hoisted(() => ({ value: true }));
const router = vi.hoisted(() => ({
  route: '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
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

describe('DeploymentsRouteTabs', () => {
  beforeEach(() => {
    router.route = '/orgs/[orgSlug]/projects/[appSubdomain]/deployments';
    settingsDisabled.value = false;
    isPlatform.value = true;
  });

  it('renders Deployments route tabs in product and settings order', () => {
    render(<DeploymentsRouteTabs />);

    const nav = screen.getByRole('navigation', {
      name: 'Deployments section navigation',
    });

    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Deployments', 'Settings']);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/deployments/settings',
    );
  });

  it('marks deployment detail routes as the active Deployments tab', () => {
    router.route =
      '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]';

    render(<DeploymentsRouteTabs />);

    expect(screen.getByRole('link', { name: 'Deployments' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables tabs off platform', () => {
    isPlatform.value = false;

    render(<DeploymentsRouteTabs />);

    expect(
      screen.queryByRole('link', { name: 'Deployments' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();
  });
});

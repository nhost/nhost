import { useRouter } from 'next/router';
import { vi } from 'vitest';
import DeploymentsRouteTabs from '@/features/orgs/projects/deployments/layout/DeploymentsRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${PROJECT_ROUTE}/${route}`,
    pathname: `${PROJECT_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/${path}`,
    query: { orgSlug: 'nhost', appSubdomain: 'dashboard' },
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('DeploymentsRouteTabs', () => {
  it.each([
    ['the deployments list', 'deployments', 'deployments'],
    ['a deployment', 'deployments/[deploymentId]', 'deployments/deployment-id'],
  ])('marks only Deployments current on %s', (_name, route, path) => {
    setRoute(route, path);
    render(<DeploymentsRouteTabs />);

    const deployments = screen.getByRole('link', { name: 'Deployments' });
    expect(deployments).toHaveAttribute('href', `${PROJECT_PATH}/deployments`);
    expect(deployments).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks only Settings current on the settings page', () => {
    setRoute('deployments/settings', 'deployments/settings?github-modal');
    render(<DeploymentsRouteTabs />);

    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/deployments/settings`,
    );
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('link', { name: 'Deployments' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('disables the Deployments tab off-platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    setRoute('deployments/settings', 'deployments/settings');
    render(<DeploymentsRouteTabs />);

    expect(screen.queryByRole('link', { name: 'Deployments' })).toBeNull();
    expect(screen.getByText('Deployments')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getAllByRole('link')).toEqual([
      screen.getByRole('link', { name: 'Settings' }),
    ]);
  });
});

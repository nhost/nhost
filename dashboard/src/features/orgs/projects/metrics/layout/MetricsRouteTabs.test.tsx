import { useRouter } from 'next/router';
import { vi } from 'vitest';
import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';
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

describe('MetricsRouteTabs', () => {
  it('marks only Metrics current on the metrics page', () => {
    setRoute('metrics', 'metrics');
    render(<MetricsRouteTabs />);

    const metrics = screen.getByRole('link', { name: 'Metrics' });
    expect(metrics).toHaveAttribute('href', `${PROJECT_PATH}/metrics`);
    expect(metrics).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks only Settings current on the settings page', () => {
    setRoute('metrics/settings', 'metrics/settings');
    render(<MetricsRouteTabs />);

    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/metrics/settings`,
    );
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Metrics' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('disables the Metrics tab off-platform', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    setRoute('metrics/settings', 'metrics/settings');
    render(<MetricsRouteTabs />);

    expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
    expect(screen.getByText('Metrics')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getAllByRole('link')).toEqual([
      screen.getByRole('link', { name: 'Settings' }),
    ]);
  });
});

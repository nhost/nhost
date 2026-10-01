import { useRouter } from 'next/router';
import { vi } from 'vitest';
import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';
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

describe('RunRouteTabs', () => {
  it('marks only Services current on the services page', () => {
    setRoute('run', 'run');
    render(<RunRouteTabs />);

    const services = screen.getByRole('link', { name: 'Services' });
    expect(services).toHaveAttribute('href', `${PROJECT_PATH}/run`);
    expect(services).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks only Settings current on the settings page', () => {
    setRoute('run/settings', 'run/settings?tab=rate-limiting');
    render(<RunRouteTabs />);

    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute('href', `${PROJECT_PATH}/run/settings`);
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Services' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

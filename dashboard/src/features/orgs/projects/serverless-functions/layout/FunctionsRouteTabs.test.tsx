import { useRouter } from 'next/router';
import { vi } from 'vitest';
import FunctionsRouteTabs from '@/features/orgs/projects/serverless-functions/layout/FunctionsRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const FUNCTIONS_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/functions';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${FUNCTIONS_ROUTE}/${route}`,
    pathname: `${FUNCTIONS_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/functions/${path}`,
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

describe('FunctionsRouteTabs', () => {
  it('marks Functions current on the function list', () => {
    setRoute('browser', 'browser');
    render(<FunctionsRouteTabs />);

    const functions = screen.getByRole('link', { name: 'Functions' });
    expect(functions).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/functions/browser`,
    );
    expect(functions).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('keeps Functions current on a nested function page', () => {
    setRoute('browser/[...functionSlug]', 'browser/users/settings');
    render(<FunctionsRouteTabs />);

    expect(screen.getByRole('link', { name: 'Functions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('marks only Settings current on the settings page', () => {
    setRoute('settings', 'settings?tab=rate-limiting');
    render(<FunctionsRouteTabs />);

    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/functions/settings`,
    );
    expect(settings).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Functions' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

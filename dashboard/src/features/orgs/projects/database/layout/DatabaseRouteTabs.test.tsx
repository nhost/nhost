import { useRouter } from 'next/router';
import { vi } from 'vitest';
import DatabaseRouteTabs from '@/features/orgs/projects/database/layout/DatabaseRouteTabs';
import { mockRouter } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/components/common/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const PROJECT_PATH = '/orgs/nhost/projects/dashboard';
const DATABASE_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/database';

function setRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${DATABASE_ROUTE}/${route}`,
    pathname: `${DATABASE_ROUTE}/${route}`,
    asPath: `${PROJECT_PATH}/database/${path}`,
    query: {
      orgSlug: 'nhost',
      appSubdomain: 'dashboard',
      dataSourceSlug: 'default',
    },
  });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('DatabaseRouteTabs', () => {
  it('links to SQL Console and activates only that tab on the console route', () => {
    setRoute('console/[dataSourceSlug]', 'console/default');
    render(<DatabaseRouteTabs />);

    const sqlConsole = screen.getByRole('link', { name: 'SQL Console' });
    expect(sqlConsole).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/database/console/default`,
    );
    expect(sqlConsole).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Table editor & Browser' }),
    ).not.toHaveAttribute('aria-current');
  });

  it.each([
    ['backups', 'backups', 'Backups'],
    ['backups/point-in-time', 'backups/point-in-time', 'Backups'],
    ['schema/[dataSourceSlug]', 'schema/default', 'Schema Navigator'],
    ['settings', 'settings?tab=capacity', 'Settings'],
  ])('selects the intended tab for %s', (route, path, label) => {
    setRoute(route, path);
    render(<DatabaseRouteTabs />);

    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it.each([
    'console/default/details',
    'schema/default/details',
    'settings/details',
  ])('does not prefix-match an exact tab for %s', (path) => {
    setRoute(path, path);
    render(<DatabaseRouteTabs />);

    expect(
      screen.queryByRole('link', { current: 'page' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['browser/[dataSourceSlug]', 'browser/default'],
    [
      'browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
      'browser/default/public/tables/users',
    ],
  ])('keeps only the browser tab active on %s', (route, path) => {
    setRoute(route, path);
    render(<DatabaseRouteTabs />);

    expect(
      screen.getByRole('link', { name: 'Table editor & Browser' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'SQL Console' }),
    ).not.toHaveAttribute('aria-current');
  });
});

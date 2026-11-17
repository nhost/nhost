import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import * as graphql from '@/generated/graphql';
import DatabaseSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockRouter,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

// These tests cover which tab the page picks; the tabs' own settings are
// covered by their components' tests.
vi.mock(
  '@/features/orgs/projects/database/settings/components/DatabaseServiceVersionSettings',
  () => ({ DatabaseServiceVersionSettings: () => <p>version content</p> }),
);
vi.mock(
  '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacity',
  () => ({ DatabaseStorageCapacity: () => <p>capacity content</p> }),
);
vi.mock(
  '@/features/orgs/projects/database/settings/components/DatabasePiTRSettings',
  () => ({ DatabasePiTRSettings: () => <p>point-in-time content</p> }),
);
vi.mock(
  '@/features/orgs/projects/database/settings/components/DatabaseConnectionInfo',
  () => ({ DatabaseConnectionInfo: () => <p>access content</p> }),
);
vi.mock(
  '@/features/orgs/projects/database/settings/components/DatabaseAllowedCIDRs',
  () => ({ DatabaseAllowedCIDRs: () => null }),
);
vi.mock(
  '@/features/orgs/projects/database/settings/components/ResetDatabasePasswordSettings',
  () => ({
    ResetDatabasePasswordSettings: () => <p>reset-password content</p>,
  }),
);

const server = setupServer(
  tokenQuery,
  http.get('*/v1/version', () => HttpResponse.json({ version: 'v2.0.0' })),
);

const SETTINGS_ROUTE =
  '/orgs/[orgSlug]/projects/[appSubdomain]/database/settings';

function renderTab(tab: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: SETTINGS_ROUTE,
    isReady: true,
    query: { ...mockRouter.query, tab },
  });
  render(<DatabaseSettingsPage />);
}

function loadSettings() {
  vi.mocked(useProject).mockReturnValue({
    project: mockApplication,
    loading: false,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
  vi.spyOn(graphql, 'useGetPostgresSettingsQuery').mockReturnValue({
    data: { config: null },
    error: undefined,
  } as unknown as ReturnType<typeof graphql.useGetPostgresSettingsQuery>);
}

function expectDefaultTabWithCorrectedUrl() {
  expect(
    screen.getByRole('heading', { level: 1, name: 'Postgres version' }),
  ).toBeInTheDocument();
  expect(screen.getByText('version content')).toBeInTheDocument();
  expect(mockRouter.replace).toHaveBeenCalledWith(
    {
      pathname: SETTINGS_ROUTE,
      query: { ...mockRouter.query, tab: 'version' },
    },
    undefined,
    { shallow: true },
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.mocked(useProject).mockReturnValue({
    project: null,
    loading: true,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(mockRouter.replace).mockResolvedValue(true);
  vi.mocked(mockRouter.push).mockResolvedValue(true);
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('DatabaseSettingsPage', () => {
  it('redirects before querying Postgres settings when settings are disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    vi.mocked(useProject).mockReturnValue({
      project: mockApplication,
      loading: false,
      projectNotFound: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(useRouter).mockReturnValue({
      ...mockRouter,
      pathname: SETTINGS_ROUTE,
      route: SETTINGS_ROUTE,
      asPath: '/orgs/local/projects/local/database/settings?tab=version',
      query: { orgSlug: 'local', appSubdomain: 'local', tab: 'version' },
    });
    const settingsQuery = vi.spyOn(graphql, 'useGetPostgresSettingsQuery');

    render(DatabaseSettingsPage.getLayout(<DatabaseSettingsPage />));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(settingsQuery).not.toHaveBeenCalled();
  });

  it('shows the default tab for an unknown tab and corrects the URL', () => {
    loadSettings();
    renderTab('unknown');

    expectDefaultTabWithCorrectedUrl();
  });

  it.each([
    ['version', 'Postgres version'],
    ['capacity', 'Capacity'],
    ['point-in-time', 'Point-in-Time Recovery'],
    ['access', 'Access'],
    ['reset-password', 'Reset password'],
  ])('renders the %s tab on the platform', (tab, title) => {
    loadSettings();
    renderTab(tab);

    expect(
      screen.getByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${tab} content`)).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('renders the capacity tab for a local project', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    loadSettings();
    renderTab('capacity');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Capacity' }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it.each(['point-in-time', 'access', 'custom-domain', 'reset-password'])(
    'shows the default tab instead of the platform-only %s tab for a local project',
    (tab) => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      loadSettings();
      renderTab(tab);

      expectDefaultTabWithCorrectedUrl();
    },
  );

  it('shows a spinner instead of a tab until the settings are loaded', () => {
    renderTab('capacity');

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText('capacity content')).not.toBeInTheDocument();
  });
});

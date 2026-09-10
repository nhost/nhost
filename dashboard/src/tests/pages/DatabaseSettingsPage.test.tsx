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
import { queryClient, render, waitFor } from '@/tests/testUtils';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

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

  it('redirects invalid tabs to the default tab', () => {
    renderTab('unknown');

    expect(mockRouter.replace).toHaveBeenCalledWith(
      {
        pathname: SETTINGS_ROUTE,
        query: { ...mockRouter.query, tab: 'version' },
      },
      undefined,
      { shallow: true },
    );
  });

  it('does not redirect valid tabs', () => {
    renderTab('capacity');

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

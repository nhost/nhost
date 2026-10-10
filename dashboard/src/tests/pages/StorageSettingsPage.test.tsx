import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import * as graphql from '@/generated/graphql';
import StorageSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/storage/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectStateQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [mockOrganization],
    currentOrg: mockOrganization,
    loading: false,
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useRunServices', () => ({
  useRunServices: () => ({ services: [] }),
}));
vi.mock('@/hooks/useTrackEvent', () => ({ useTrackEvent: () => vi.fn() }));

const storageSettingsRequested = vi.fn();
const server = setupServer(
  tokenQuery,
  getOrganization,
  http.get('*/v1/version', () => HttpResponse.json({ version: 'v2.0.0' })),
  getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
    desiredState: ApplicationStatus.Paused,
  }),
  nhostGraphQLLink.query('GetStorageSettings', () => {
    storageSettingsRequested();
    return HttpResponse.json({
      data: {
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          storage: {
            version: '0.7.0',
            antivirus: null,
          },
        },
      },
    });
  }),
  nhostGraphQLLink.query('getSoftwareVersions', () =>
    HttpResponse.json({ data: { softwareVersions: [] } }),
  ),
  nhostGraphQLLink.query('getRateLimitConfig', () =>
    HttpResponse.json({
      data: {
        config: {
          hasura: { rateLimit: null },
          auth: { rateLimit: null },
          storage: { rateLimit: null },
          functions: { rateLimit: null },
        },
      },
    }),
  ),
  nhostGraphQLLink.query('getAnnouncements', () =>
    HttpResponse.json({ data: { announcements: [] } }),
  ),
  nhostGraphQLLink.query('organizationMemberInvites', () =>
    HttpResponse.json({ data: { organizationMemberInvites: [] } }),
  ),
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({ data: { organizationNewRequests: [] } }),
  ),
);

const SETTINGS_ROUTE =
  '/orgs/[orgSlug]/projects/[appSubdomain]/storage/settings';

const SETTINGS_PATH = '/orgs/xyz/projects/test-project/storage/settings';

const LOCAL_SETTINGS_PATH = '/orgs/local/projects/local/storage/settings';

interface SetTabOptions {
  isReady?: boolean;
  local?: boolean;
}

function setTab(
  tab?: string | string[],
  { isReady = true, local = false }: SetTabOptions = {},
) {
  const query = new URLSearchParams();
  for (const value of typeof tab === 'string' ? [tab] : (tab ?? [])) {
    query.append('tab', value);
  }
  const settingsPath = local ? LOCAL_SETTINGS_PATH : SETTINGS_PATH;
  const routeQuery = local
    ? { orgSlug: 'local', appSubdomain: 'local' }
    : mockRouter.query;
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: SETTINGS_ROUTE,
    route: SETTINGS_ROUTE,
    asPath: `${settingsPath}?${query}`,
    isReady,
    query: { ...routeQuery, tab },
  });
}

function renderTab(tab?: string | string[]) {
  setTab(tab);
  return render(<StorageSettingsPage />);
}

function loadProject() {
  vi.mocked(useProject).mockReturnValue({
    project: mockApplication,
    loading: false,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  mockScrollIntoViewAndPointerCapture();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
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

describe('StorageSettingsPage', () => {
  it('redirects before querying Storage settings when settings are disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    loadProject();
    setTab('storage', { local: true });
    const settingsQuery = vi.spyOn(graphql, 'useGetStorageSettingsQuery');

    render(StorageSettingsPage.getLayout(<StorageSettingsPage />));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(settingsQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, 'unknown', ['storage', 'rate-limiting']])(
    'redirects the %s tab to the default tab',
    (tab) => {
      loadProject();
      renderTab(tab);

      expect(mockRouter.replace).toHaveBeenCalledWith(
        {
          pathname: SETTINGS_ROUTE,
          query: { ...mockRouter.query, tab: 'storage' },
        },
        undefined,
        { shallow: true },
      );
    },
  );

  it('waits for router readiness before normalizing a missing tab', () => {
    loadProject();
    setTab(undefined, { isReady: false });
    render(<StorageSettingsPage />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(storageSettingsRequested).not.toHaveBeenCalled();
  });

  it.each([
    ['storage', 'Storage Version', 'Storage'],
    ['rate-limiting', 'Storage', 'Storage Version'],
  ])(
    'renders the selected %s settings content',
    async (tab, heading, otherHeading) => {
      loadProject();
      renderTab(tab);

      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('heading', { name: otherHeading }),
      ).not.toBeInTheDocument();
    },
  );

  it('selects the desktop link and keeps settings reachable while paused', async () => {
    loadProject();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...mockMatchMediaValue(query),
      matches: true,
    }));
    setTab('rate-limiting');
    render(StorageSettingsPage.getLayout(<StorageSettingsPage />));

    const navigation = await screen.findByRole('navigation', {
      name: 'Storage settings navigation',
    });
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Storage', `${SETTINGS_PATH}?tab=storage`],
      ['Rate Limiting', `${SETTINGS_PATH}?tab=rate-limiting`],
    ]);
    expect(
      within(navigation).getAllByRole('link', { current: 'page' }),
    ).toEqual([
      within(navigation).getByRole('link', { name: 'Rate Limiting' }),
    ]);
    expect(
      await screen.findByRole('heading', { name: 'Storage' }),
    ).toBeVisible();
    expect(
      screen.queryByText(
        'This project is paused. Unpause to make this available.',
      ),
    ).not.toBeInTheDocument();
  });

  it('navigates to the rate limiting tab on mobile when self-hosted with a config server', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    loadProject();
    setTab('storage', { local: true });
    const user = new TestUserEvent();
    render(StorageSettingsPage.getLayout(<StorageSettingsPage />));

    const trigger = await screen.findByRole('combobox', {
      name: 'Storage settings navigation',
    });
    expect(trigger).toHaveTextContent('Storage');
    await screen.findByRole('heading', { name: 'Storage Version' });
    await user.click(trigger);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Storage', 'Rate Limiting']);
    await user.click(screen.getByRole('option', { name: 'Rate Limiting' }));
    expect(mockRouter.push).toHaveBeenCalledOnce();
    expect(mockRouter.push).toHaveBeenCalledWith(
      `${LOCAL_SETTINGS_PATH}?tab=rate-limiting`,
      undefined,
      {
        shallow: true,
        scroll: undefined,
        locale: undefined,
      },
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

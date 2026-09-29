import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import * as graphql from '@/generated/graphql';
import GraphQLSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/graphql/settings';
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

const hasuraSettingsRequested = vi.fn();
const server = setupServer(
  tokenQuery,
  getOrganization,
  http.get('*/v1/version', () => HttpResponse.json({ version: 'v2.0.0' })),
  getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
    desiredState: ApplicationStatus.Paused,
  }),
  nhostGraphQLLink.query('GetHasuraSettings', () => {
    hasuraSettingsRequested();
    return HttpResponse.json({
      data: {
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          hasura: {
            version: 'v2.0.0',
            settings: {
              enableAllowList: false,
              enableRemoteSchemaPermissions: false,
              enableConsole: true,
              devMode: false,
              corsDomain: ['*'],
              enabledAPIs: ['metadata', 'graphql'],
              inferFunctionPermissions: true,
            },
            logs: { level: 'info' },
            events: { httpPoolSize: 100 },
            resources: { networking: { ingresses: [] } },
          },
        },
      },
    });
  }),
  nhostGraphQLLink.query('GetAuthenticationSettings', () =>
    HttpResponse.json({ data: { config: { auth: null } } }),
  ),
  nhostGraphQLLink.query('GetServerlessFunctionsSettings', () =>
    HttpResponse.json({ data: { config: { functions: null } } }),
  ),
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
  '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/settings';

const SETTINGS_PATH = '/orgs/xyz/projects/test-project/graphql/settings';

const LOCAL_SETTINGS_PATH = '/orgs/local/projects/local/graphql/settings';

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
  return render(<GraphQLSettingsPage />);
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

describe('GraphQLSettingsPage', () => {
  it('redirects before querying Hasura settings when settings are disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    loadProject();
    setTab('custom-domain', { local: true });
    const settingsQuery = vi.spyOn(graphql, 'useGetHasuraSettingsQuery');

    render(GraphQLSettingsPage.getLayout(<GraphQLSettingsPage />));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(settingsQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, 'unknown', ['engine', 'access-and-tooling']])(
    'redirects the %s tab to the default tab',
    (tab) => {
      loadProject();
      renderTab(tab);

      expect(mockRouter.replace).toHaveBeenCalledWith(
        {
          pathname: SETTINGS_ROUTE,
          query: { ...mockRouter.query, tab: 'engine' },
        },
        undefined,
        { shallow: true },
      );
    },
  );

  it('waits for router readiness before normalizing a missing tab', () => {
    loadProject();
    setTab(undefined, { isReady: false });
    render(<GraphQLSettingsPage />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(hasuraSettingsRequested).not.toHaveBeenCalled();
  });

  it.each([
    ['engine', 'Hasura GraphQL Engine Version'],
    ['access-and-tooling', 'Configure CORS'],
    ['custom-domain', 'GraphQL Custom Domain'],
    ['rate-limiting', 'GraphQL'],
  ])('renders the selected %s settings content', async (tab, heading) => {
    loadProject();
    renderTab(tab);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', {
        name:
          tab === 'engine'
            ? 'GraphQL Custom Domain'
            : 'Hasura GraphQL Engine Version',
      }),
    ).not.toBeInTheDocument();
  });

  it('selects the desktop link and keeps settings reachable while paused', async () => {
    loadProject();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...mockMatchMediaValue(query),
      matches: true,
    }));
    setTab('access-and-tooling');
    render(GraphQLSettingsPage.getLayout(<GraphQLSettingsPage />));

    const navigation = await screen.findByRole('navigation', {
      name: 'GraphQL settings navigation',
    });
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Engine', `${SETTINGS_PATH}?tab=engine`],
      ['Access and tooling', `${SETTINGS_PATH}?tab=access-and-tooling`],
      ['Custom Domain', `${SETTINGS_PATH}?tab=custom-domain`],
      ['Rate Limiting', `${SETTINGS_PATH}?tab=rate-limiting`],
    ]);
    expect(
      within(navigation).getAllByRole('link', { current: 'page' }),
    ).toEqual([
      within(navigation).getByRole('link', { name: 'Access and tooling' }),
    ]);
    expect(
      await screen.findByText('GitHub repository connected'),
    ).toBeVisible();
    expect(
      screen.queryByText(
        'This project is paused. Unpause to make this available.',
      ),
    ).not.toBeInTheDocument();
  });

  it('navigates to the custom domain tab on mobile when self-hosted with a config server', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    loadProject();
    setTab('engine', { local: true });
    const user = new TestUserEvent();
    const { rerender } = render(
      GraphQLSettingsPage.getLayout(<GraphQLSettingsPage />),
    );

    const trigger = await screen.findByRole('combobox', {
      name: 'GraphQL settings navigation',
    });
    expect(trigger).toHaveTextContent('Engine');
    await screen.findByRole('heading', {
      name: 'Hasura GraphQL Engine Version',
    });
    await user.click(trigger);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Engine',
      'Access and tooling',
      'Custom Domain',
      'Rate Limiting',
    ]);
    await user.click(screen.getByRole('option', { name: 'Custom Domain' }));
    expect(mockRouter.push).toHaveBeenCalledOnce();
    expect(mockRouter.push).toHaveBeenCalledWith(
      `${LOCAL_SETTINGS_PATH}?tab=custom-domain`,
      undefined,
      {
        shallow: true,
        scroll: undefined,
        locale: undefined,
      },
    );
    setTab('custom-domain', { local: true });
    rerender(GraphQLSettingsPage.getLayout(<GraphQLSettingsPage />));
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'GraphQL settings navigation' }),
      ).toHaveTextContent('Custom Domain');
    });
    expect(
      await screen.findByRole('heading', { name: 'GraphQL Custom Domain' }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

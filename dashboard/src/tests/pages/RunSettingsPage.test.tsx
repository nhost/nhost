import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { UseGetRunServiceRateLimitsReturn } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits/useGetRunServiceRateLimits';
import RunSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/run/settings';
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
const mocks = vi.hoisted(() => ({
  runServices: [] as RunService[],
  rateLimitServices: [] as UseGetRunServiceRateLimitsReturn['services'],
  runServicesError: undefined as Error | undefined,
  rateLimitServicesError: undefined as Error | undefined,
}));

vi.mock('@/features/orgs/projects/common/hooks/useRunServices', () => ({
  useRunServices: () => ({
    services: mocks.runServices,
    loading: false,
    error: mocks.runServicesError,
  }),
}));
vi.mock(
  '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits',
  () => ({
    useGetRunServiceRateLimits: () => ({
      services: mocks.rateLimitServices,
      loading: false,
      error: mocks.rateLimitServicesError,
    }),
  }),
);
vi.mock('@/hooks/useTrackEvent', () => ({ useTrackEvent: () => vi.fn() }));

const server = setupServer(
  tokenQuery,
  getOrganization,
  http.get('*/v1/version', () => HttpResponse.json({ version: 'v2.0.0' })),
  getProjectStateQuery([{ stateId: ApplicationStatus.Live }], {
    desiredState: ApplicationStatus.Live,
  }),
  nhostGraphQLLink.query('GetServerlessFunctionsSettings', () =>
    HttpResponse.json({ data: { config: { functions: null } } }),
  ),
  nhostGraphQLLink.query('GetAuthenticationSettings', () =>
    HttpResponse.json({ data: { config: { auth: null } } }),
  ),
  nhostGraphQLLink.query('GetHasuraSettings', () =>
    HttpResponse.json({ data: { config: { hasura: null } } }),
  ),
);

const SETTINGS_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/run/settings';
const PROJECT_PATH = '/orgs/xyz/projects/test-project';
const LOCAL_PROJECT_PATH = '/orgs/local/projects/local';
const UPGRADE_TEXT =
  'To unlock Custom Domains, transfer this project to a Pro or Team organization.';

interface SetTabOptions {
  isReady?: boolean;
  local?: boolean;
}

function setTab(
  tab: string | undefined,
  { isReady = true, local = false }: SetTabOptions = {},
) {
  const projectPath = local ? LOCAL_PROJECT_PATH : PROJECT_PATH;
  const routeQuery = local
    ? { orgSlug: 'local', appSubdomain: 'local' }
    : mockRouter.query;
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: SETTINGS_ROUTE,
    route: SETTINGS_ROUTE,
    asPath: `${projectPath}/run/settings${tab ? `?tab=${tab}` : ''}`,
    isReady,
    query: { ...routeQuery, tab },
  });
}

function loadProject() {
  vi.mocked(useProject).mockReturnValue({
    project: mockApplication,
    loading: false,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
}

function setDesktopLayout() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    ...mockMatchMediaValue(query),
    matches: true,
  }));
}

function renderSettingsPage() {
  render(RunSettingsPage.getLayout(<RunSettingsPage />));
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  mocks.runServices = [];
  mocks.rateLimitServices = [];
  mocks.runServicesError = undefined;
  mocks.rateLimitServicesError = undefined;
  mockScrollIntoViewAndPointerCapture();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.mocked(useProject).mockReturnValue({
    project: null,
    loading: true,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(mockRouter.replace).mockResolvedValue(true);
  vi.mocked(mockRouter.push).mockResolvedValue(true);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

afterAll(() => server.close());

describe('RunSettingsPage tab selection', () => {
  it.each([undefined, 'unknown'])(
    'redirects the %s tab to the custom-domain tab',
    (tab) => {
      setTab(tab);
      render(<RunSettingsPage />);

      expect(mockRouter.replace).toHaveBeenCalledExactlyOnceWith(
        {
          pathname: SETTINGS_ROUTE,
          query: { ...mockRouter.query, tab: 'custom-domain' },
        },
        undefined,
        { shallow: true },
      );
      expect(
        screen.queryByText('Loading Run custom domain settings...'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Loading Run rate limit settings...'),
      ).not.toBeInTheDocument();
    },
  );

  it('waits for router readiness before normalizing a missing tab', () => {
    setTab(undefined, { isReady: false });
    render(<RunSettingsPage />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['custom-domain', 'Loading Run custom domain settings...'],
    ['rate-limiting', 'Loading Run rate limit settings...'],
  ])('renders the %s tab without redirecting', (tab, loadingText) => {
    setTab(tab);
    render(<RunSettingsPage />);

    expect(screen.getByText(loadingText)).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('RunSettingsPage custom domain', () => {
  beforeEach(() => {
    loadProject();
    setTab('custom-domain');
  });

  it('shows the upgrade banner instead of the domain forms for a free organization', async () => {
    mocks.runServices = [
      {
        id: 'api-id',
        config: { name: 'api', ports: [{ port: 8080, type: 'http' }] },
      },
    ] as unknown as RunService[];
    server.use(
      nhostGraphQLLink.query('getOrganization', () =>
        HttpResponse.json({
          data: {
            organizations: [
              {
                ...mockOrganization,
                plan: { ...mockOrganization.plan, isFree: true },
              },
            ],
          },
        }),
      ),
    );
    renderSettingsPage();

    expect(await screen.findByText(UPGRADE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText('api')).not.toBeInTheDocument();
  });

  it('shows the domain forms linking back to Services for a paid organization', async () => {
    mocks.runServices = [
      {
        id: 'api-id',
        config: { name: 'api', ports: [{ port: 8080, type: 'http' }] },
      },
      { id: 'worker-id', config: { name: 'worker', ports: [] } },
    ] as unknown as RunService[];
    renderSettingsPage();

    const serviceName = await screen.findByText('api');
    const serviceHeader = serviceName.parentElement as HTMLElement;
    expect(within(serviceHeader).getByRole('link')).toHaveAttribute(
      'href',
      `${PROJECT_PATH}/run`,
    );
    expect(screen.queryByText('worker')).not.toBeInTheDocument();
    expect(screen.queryByText(UPGRADE_TEXT)).not.toBeInTheDocument();
  });

  it('explains that custom domains need a port when no Run service has one', async () => {
    mocks.runServices = [
      { id: 'worker-id', config: { name: 'worker', ports: [] } },
    ] as unknown as RunService[];
    renderSettingsPage();

    expect(
      await screen.findByText('No Run services with ports'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No Run services yet')).not.toBeInTheDocument();
  });

  it('shows the error instead of the empty state when loading Run services fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.runServicesError = new Error('Failed to fetch Run services');
    renderSettingsPage();

    expect(
      await screen.findByText('Failed to fetch Run services'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No Run services yet')).not.toBeInTheDocument();
  });
});

describe('RunSettingsPage rate limiting', () => {
  beforeEach(() => {
    loadProject();
    setTab('rate-limiting');
  });

  it('renders a form per published HTTP service and marks its link active', async () => {
    mocks.rateLimitServices = [
      {
        id: 'public-api-id',
        name: 'public-api',
        enabled: true,
        ports: [
          {
            type: 'http',
            port: '8080',
            publish: true,
            rateLimit: { limit: 100, interval: 1, intervalUnit: 'm' },
          },
        ],
      },
      {
        id: 'tcp-id',
        name: 'tcp-service',
        enabled: false,
        ports: [{ type: 'tcp', port: '5432', publish: true }],
      },
    ];
    setDesktopLayout();
    renderSettingsPage();

    const navigation = await screen.findByRole('navigation', {
      name: 'Run settings navigation',
    });
    expect(
      within(navigation).getAllByRole('link', { current: 'page' }),
    ).toEqual([
      within(navigation).getByRole('link', { name: 'Rate Limiting' }),
    ]);
    expect(await screen.findByText('public-api')).toBeInTheDocument();
    expect(screen.queryByText('tcp-service')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no Run services', async () => {
    renderSettingsPage();

    expect(await screen.findByText('No Run services yet')).toBeInTheDocument();
  });

  it('explains that rate limiting needs a published HTTP port', async () => {
    mocks.rateLimitServices = [
      {
        id: 'tcp-id',
        name: 'tcp-service',
        enabled: false,
        ports: [{ type: 'tcp', port: '5432', publish: true }],
      },
      {
        id: 'private-http-id',
        name: 'private-http-service',
        enabled: false,
        ports: [{ type: 'http', port: '8080', publish: false }],
      },
    ];
    renderSettingsPage();

    expect(
      await screen.findByText('No published HTTP ports'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No Run services yet')).not.toBeInTheDocument();
  });

  it('shows the error instead of the empty state when loading rate limits fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rateLimitServicesError = new Error('Failed to fetch rate limits');
    renderSettingsPage();

    expect(
      await screen.findByText('Failed to fetch rate limits'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No Run services yet')).not.toBeInTheDocument();
  });
});

describe('RunSettingsPage self-hosted access', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    loadProject();
    setTab('custom-domain', { local: true });
  });

  it('shows the custom-domain tab with a link back to Services when a config server is configured', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    setDesktopLayout();
    renderSettingsPage();

    const navigation = await screen.findByRole('navigation', {
      name: 'Run settings navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Custom Domain' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await screen.findByRole('link', { name: 'Go to Services' }),
    ).toHaveAttribute('href', `${LOCAL_PROJECT_PATH}/run`);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('still blocks settings when no config server is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    renderSettingsPage();

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(
      screen.queryByRole('link', { name: 'Go to Services' }),
    ).not.toBeInTheDocument();
  });
});

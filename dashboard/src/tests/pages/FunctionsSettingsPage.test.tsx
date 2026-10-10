import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import FunctionsSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/functions/settings';
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
  useRunServices: () => ({ services: [], loading: false }),
}));
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
);
const SETTINGS_ROUTE =
  '/orgs/[orgSlug]/projects/[appSubdomain]/functions/settings';
const LOCAL_SETTINGS_PATH = '/orgs/local/projects/local/functions/settings';

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
  const settingsPath = local
    ? LOCAL_SETTINGS_PATH
    : '/orgs/xyz/projects/test-project/functions/settings';
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

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
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

describe('FunctionsSettingsPage tab selection', () => {
  it.each([undefined, 'unknown'])(
    'redirects the %s tab to the custom-domain tab',
    (tab) => {
      setTab(tab);
      render(<FunctionsSettingsPage />);

      expect(mockRouter.replace).toHaveBeenCalledExactlyOnceWith(
        {
          pathname: SETTINGS_ROUTE,
          query: { ...mockRouter.query, tab: 'custom-domain' },
        },
        undefined,
        { shallow: true },
      );
      expect(
        screen.queryByText('Loading Functions custom domain settings...'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Loading Functions rate limit settings...'),
      ).not.toBeInTheDocument();
    },
  );

  it('waits for router readiness before normalizing a missing tab', () => {
    setTab(undefined, { isReady: false });
    render(<FunctionsSettingsPage />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['custom-domain', 'Loading Functions custom domain settings...'],
    ['rate-limiting', 'Loading Functions rate limit settings...'],
  ])('renders the %s tab without redirecting', (tab, loadingText) => {
    setTab(tab);
    render(<FunctionsSettingsPage />);

    expect(screen.getByText(loadingText)).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('preserves selecting the first repeated tab query parameter', () => {
    setTab(['rate-limiting', 'custom-domain']);
    render(<FunctionsSettingsPage />);

    expect(
      screen.getByText('Loading Functions rate limit settings...'),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('FunctionsSettingsPage content', () => {
  beforeEach(() => {
    loadProject();
  });

  it('shows the upgrade banner instead of the custom-domain form for a free organization', async () => {
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
    setTab('custom-domain');
    render(FunctionsSettingsPage.getLayout(<FunctionsSettingsPage />));

    expect(
      await screen.findByText(
        'To unlock Custom Domains, transfer this project to a Pro or Team organization.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: 'Serverless Functions Custom Domain',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows the custom-domain form for a paid organization', async () => {
    setTab('custom-domain');
    render(FunctionsSettingsPage.getLayout(<FunctionsSettingsPage />));

    expect(
      await screen.findByRole('heading', {
        name: 'Serverless Functions Custom Domain',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'To unlock Custom Domains, transfer this project to a Pro or Team organization.',
      ),
    ).not.toBeInTheDocument();
  });

  it('renders the rate limiting form and marks its link active', async () => {
    setDesktopLayout();
    setTab('rate-limiting');
    render(FunctionsSettingsPage.getLayout(<FunctionsSettingsPage />));

    const navigation = await screen.findByRole('navigation', {
      name: 'Functions settings navigation',
    });
    expect(
      within(navigation).getAllByRole('link', { current: 'page' }),
    ).toEqual([
      within(navigation).getByRole('link', { name: 'Rate Limiting' }),
    ]);
    expect(
      await screen.findByRole('heading', { name: 'Functions' }),
    ).toBeInTheDocument();
  });
});

describe('FunctionsSettingsPage self-hosted access', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    loadProject();
    setTab('custom-domain', { local: true });
  });

  it('shows the custom-domain link and form when a config server is configured', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    setDesktopLayout();
    const user = new TestUserEvent();
    render(FunctionsSettingsPage.getLayout(<FunctionsSettingsPage />));

    const navigation = await screen.findByRole('navigation', {
      name: 'Functions settings navigation',
    });
    const customDomainLink = within(navigation).getByRole('link', {
      name: 'Custom Domain',
    });
    expect(customDomainLink).toHaveAttribute(
      'href',
      `${LOCAL_SETTINGS_PATH}?tab=custom-domain`,
    );
    expect(customDomainLink).toHaveAttribute('aria-current', 'page');
    expect(
      await screen.findByRole('heading', {
        name: 'Serverless Functions Custom Domain',
      }),
    ).toBeVisible();

    await user.type(
      screen.getByPlaceholderText('functions.mydomain.dev'),
      'functions.example.com',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('still blocks settings when no config server is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    render(FunctionsSettingsPage.getLayout(<FunctionsSettingsPage />));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(
      screen.queryByRole('heading', {
        name: 'Serverless Functions Custom Domain',
      }),
    ).not.toBeInTheDocument();
  });
});

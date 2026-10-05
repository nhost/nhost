import { graphql, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import NativeQueriesIndexPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]';
import { mockMatchMediaValue } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  isPlatform: false,
  router: {
    isReady: true,
    asPath: '/orgs/test/projects/local/database/native-queries',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: '',
    },
    push: vi.fn(),
    replace: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
}));
vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => mocks.isPlatform,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      id: 'test-app-id',
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));

function hasuraVersionHandler(hasuraVersion: string) {
  return graphql.query('getConfiguredVersions', () =>
    HttpResponse.json({
      data: { config: { hasura: { version: hasuraVersion } } },
    }),
  );
}

const server = setupServer(tokenQuery, hasuraVersionHandler('v2.48.10-ce'));

describe('native-query source routes', () => {
  vi.stubEnv(
    'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
    'https://my-config-server.com',
  );

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.isPlatform = false;
    mocks.router.query.dataSourceSlug = '';
    mocks.router.push.mockReset().mockResolvedValue(true);
    mocks.router.replace.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('never falls back from an explicit unknown source URL', async () => {
    mocks.router.query.dataSourceSlug = 'missing';
    render(<NativeQueriesIndexPage />);

    await screen.findByRole('heading', { name: 'Database not found' });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it('replaces the page and sidebar with an upgrade prompt when Hasura is older than v2.33.0', async () => {
    mocks.isPlatform = true;
    mocks.router.query.dataSourceSlug = 'default';
    server.use(hasuraVersionHandler('v2.25.1-ce'));

    render(
      <>
        <NativeQueriesBrowserSidebar />
        <NativeQueriesIndexPage />
      </>,
    );

    expect(
      await screen.findByRole('heading', { name: 'GraphQL Engine Too Old' }),
    ).toBeInTheDocument();
    // FeatureSidebar renders the sidebar as an <aside> (role "complementary").
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

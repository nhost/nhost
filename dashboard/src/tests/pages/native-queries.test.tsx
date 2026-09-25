import NativeQueriesLandingPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries';
import NativeQueriesIndexPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, waitFor } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
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
  useIsPlatform: () => false,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));

describe('native-query source routes', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.router.query.dataSourceSlug = '';
    mocks.router.push.mockReset().mockResolvedValue(true);
    mocks.router.replace.mockReset().mockResolvedValue(true);
  });

  it('redirects the landing route to the default source', async () => {
    render(<NativeQueriesLandingPage />);

    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith(
        '/orgs/test/projects/local/database/native-queries/default',
      ),
    );
  });

  it('never falls back from an explicit unknown source URL', async () => {
    mocks.router.query.dataSourceSlug = 'missing';
    render(<NativeQueriesIndexPage />);

    await screen.findByRole('heading', { name: 'Database not found' });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
});

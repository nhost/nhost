import { mockOrganization } from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import { setupServer } from 'msw/node';
import { afterEach, describe, vi } from 'vitest';
import OrganizationGuard from './OrganizationGuard';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function TestComponent() {
  return (
    <OrganizationGuard>
      <h1>Organization loaded</h1>
    </OrganizationGuard>
  );
}

const server = setupServer(tokenQuery);

const getUseRouterObject = () => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  asPath: '/orgs/xyz/projects/test-project',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
  },
  push: mocks.push,
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
});

describe('OrganizationGuard', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    mocks.useRouter.mockRestore();
    mocks.push.mockRestore();
    vi.restoreAllMocks();
  });

  it('should redirect to not found page if sever did not returned an org', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    const emptyOrgResolver = createGraphqlMockResolver(
      'getOrganization',
      'query',
    );
    server.use(emptyOrgResolver.handler);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.queryByText('Organization loaded')).not.toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });

    emptyOrgResolver.resolve({
      organizations: [],
    });

    await waitFor(() => {
      expect(screen.queryByText('Organization loaded')).not.toBeInTheDocument();
      expect(mocks.push).toHaveBeenCalledWith('/404');
    });
  });

  it('Should render the children if there is an org returned from the server', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    const orgResolver = createGraphqlMockResolver('getOrganization', 'query');
    server.use(orgResolver.handler);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.queryByText('Organization loaded')).not.toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });
    orgResolver.resolve({
      organizations: [{ ...mockOrganization }],
    });

    await waitFor(() => {
      expect(screen.queryByText('Organization loaded')).toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });
  });
});

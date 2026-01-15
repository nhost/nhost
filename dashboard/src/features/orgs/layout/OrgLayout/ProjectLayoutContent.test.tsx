import { setupServer } from 'msw/node';
import { afterEach, describe, vi } from 'vitest';
import { mockApplication } from '@/tests/mocks';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import ProjectLayoutContent from './ProjectLayoutContent';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function TestComponent() {
  return (
    <ProjectLayoutContent>
      <h1>Project loaded</h1>
    </ProjectLayoutContent>
  );
}

const server = setupServer(tokenQuery, getProjectStateQuery());

const getUseRouterObject = (
  route: string = '/orgs/[orgSlug]/projects/[appSubdomain]',
) => ({
  basePath: '',
  pathname: '/orgs/xyz/projects/test-project',
  route,
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

describe('ProjectLayoutContent', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  afterEach(() => {
    queryClient.clear();
    mocks.useRouter.mockRestore();
    mocks.push.mockRestore();
    vi.restoreAllMocks();
  });

  it('should render children if project returned from server', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    const projectStateResolver = createGraphqlMockResolver(
      'getProjectState',
      'query',
    );
    server.use(projectStateResolver.handler);
    server.use(getProjectQuery);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('projectLoadingIndicator')).toBeInTheDocument();
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
    });

    projectStateResolver.resolve({
      apps: [
        {
          ...mockApplication,
          githubRepository: null,
          appStates: [
            {
              id: '3f5c64ec-9172-4c34-8a7e-c84b3b6e78b9',
              appId: '9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96',
              message: '',
              stateId: 5,
              createdAt: '2025-07-28T13:26:12.430607+00:00',
            },
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });
  });

  it('should redirect to not found page if sever did not returned a project', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    const emptyProjectStateResolver = createGraphqlMockResolver(
      'getProjectState',
      'query',
    );
    server.use(emptyProjectStateResolver.handler);
    server.use(getProjectQuery);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
    });

    emptyProjectStateResolver.resolve({
      apps: [],
    });

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });
  });

  it.each([
    {
      description:
        'should redirect to 404 if we are not on platform and on a the deployments page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
    },
    {
      description:
        'should redirect to 404 if we are not on platform and on a the logs page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/logs',
    },
    {
      description:
        'should redirect to 404 if we are not on platform and on a the backups page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/backups',
    },
    {
      description:
        'should redirect to 404 if we are not on platform and on a the metrics page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/metrics',
    },
    {
      description:
        "should redirect to 404 if we are not on platform and on the deployment's detail page",
      route:
        '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]',
    },
  ])('$description', async ({ route }) => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    mocks.useRouter.mockImplementation(() => getUseRouterObject(route));

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
      expect(mocks.push).toHaveBeenCalledWith('/404');
    });
  });

  it.each([
    {
      description:
        "should not redirect to 404 if we are on platform and on the deployment's detail page",
      route:
        '/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]',
    },
    {
      description:
        'should not redirect to 404 if we are on platform and on the deployments page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/deployments',
    },
    {
      description:
        'should not redirect to 404 if we are on platform and on the backups page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/backups',
    },
    {
      description:
        'should not redirect to 404 if we are on platform and on the logs page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/logs',
    },
    {
      description:
        'should not redirect to 404 if we are on platform and on the metrics page',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/metrics',
    },
  ])('$description', async ({ route }) => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    mocks.useRouter.mockImplementation(() => getUseRouterObject(route));
    const projectStateResolver = createGraphqlMockResolver(
      'getProjectState',
      'query',
    );
    server.use(projectStateResolver.handler);
    server.use(getProjectQuery);

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('projectLoadingIndicator')).toBeInTheDocument();
      expect(screen.queryByText('Project loaded')).not.toBeInTheDocument();
    });

    projectStateResolver.resolve({
      apps: [
        {
          ...mockApplication,
          githubRepository: null,
          appStates: [
            {
              id: '3f5c64ec-9172-4c34-8a7e-c84b3b6e78b9',
              appId: '9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96',
              message: '',
              stateId: 5,
              createdAt: '2025-07-28T13:26:12.430607+00:00',
            },
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(screen.queryByText('Project loaded')).toBeInTheDocument();
      expect(mocks.push).not.toHaveBeenCalledWith('/404');
    });
  });
});

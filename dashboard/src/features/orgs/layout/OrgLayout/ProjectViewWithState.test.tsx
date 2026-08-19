import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import { PROJECT_WITH_STATE_QUERY_KEY } from '@/features/orgs/projects/hooks/useProjectWithState';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  createGraphqlMockResolver,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import ProjectViewWithState from './ProjectViewWithState';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
  useAppPausedReason: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppPausedReason', () => ({
  useAppPausedReason: mocks.useAppPausedReason,
}));

vi.mock(
  '@/features/orgs/projects/common/components/ApplicationProvisioning',
  () => ({
    ApplicationProvisioning: () => <div>Application Provisioning</div>,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/components/ApplicationUnknown',
  () => ({
    ApplicationUnknown: () => (
      <div data-testid="appUnknown">Application Unknown</div>
    ),
  }),
);

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

function TestComponent() {
  return (
    <ProjectViewWithState>
      <h1>Application content</h1>
    </ProjectViewWithState>
  );
}

let statefulChildMountCount = 0;

function StatefulChild() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    statefulChildMountCount += 1;
  }, []);

  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      {count}
    </button>
  );
}

const applicationState = (stateId: ApplicationStatus) => ({
  id: 'app-state-id',
  appId: mockApplication.id,
  message: '',
  stateId,
  createdAt: mockApplication.createdAt,
});

const getApplicationStateQuery = (stateId: ApplicationStatus) =>
  nhostGraphQLLink.query('getApplicationState', () =>
    HttpResponse.json({
      data: {
        app: {
          id: mockApplication.id,
          name: mockApplication.name,
          appStates: [applicationState(stateId)],
        },
      },
    }),
  );

const server = setupServer(tokenQuery);

describe('ProjectViewWithState', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    server.resetHandlers();
    statefulChildMountCount = 0;
    mocks.useAppPausedReason.mockReturnValue({
      isLocked: false,
      lockedReason: '',
      freeAndLiveProjectsNumberExceeded: false,
      loading: false,
    });
  });

  afterEach(() => {
    queryClient.clear();
    mocks.useRouter.mockRestore();
    mocks.push.mockRestore();
    vi.restoreAllMocks();
  });

  afterAll(() => server.close());

  it('should render the nothing when the state is empty', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Empty }]));
    render(<TestComponent />);
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
  });

  it('should render the application in provisioning state', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Provisioning }]),
    );
    render(<TestComponent />);
    expect(
      await screen.findByText('Application Provisioning'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
  });

  it('should render the application in pausing state with overlay', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    server.use(getProjectQuery);
    server.use(getApplicationStateQuery(ApplicationStatus.Pausing));
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Pausing }]));
    render(<TestComponent />);
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Project is pausing...'),
    ).toBeInTheDocument();
  });

  it('should render the application in unpausing state with overlay', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    server.use(getProjectQuery);
    server.use(getApplicationStateQuery(ApplicationStatus.Unpausing));
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Unpausing }]),
    );
    render(<TestComponent />);
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Project is waking up...'),
    ).toBeInTheDocument();
  });

  it('should render the application in paused state with overlay', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Paused }]));
    render(<TestComponent />);
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        'This project is paused. Unpause to make this available.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wake up' })).toBeInTheDocument();
    expect(
      screen.queryByText(/Only 1 free project can be active at a time/),
    ).not.toBeInTheDocument();
  });

  it('should refetch project state after requesting an unpause', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );

    let projectState = ApplicationStatus.Paused;
    const getProjectState = vi.fn();
    const unpauseApplication = vi.fn();
    const applicationStateResolver = createGraphqlMockResolver(
      'getApplicationState',
      'query',
    );

    server.use(
      getProjectQuery,
      applicationStateResolver.handler,
      nhostGraphQLLink.query('getProjectState', () => {
        getProjectState();
        return HttpResponse.json({
          data: {
            apps: [
              {
                ...mockApplication,
                appStates: [{ stateId: projectState }],
              },
            ],
          },
        });
      }),
      nhostGraphQLLink.mutation('UnpauseApplication', () => {
        unpauseApplication();
        projectState = ApplicationStatus.Unpausing;
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    render(<TestComponent />);

    const user = new TestUserEvent();
    const wakeUpButton = await screen.findByRole('button', {
      name: 'Wake up',
    });
    await user.click(wakeUpButton);

    await waitFor(() => {
      expect(unpauseApplication).toHaveBeenCalledOnce();
      expect(wakeUpButton).toBeDisabled();
    });

    await waitFor(
      () => {
        expect(screen.getByText('Project is waking up...')).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Wake up' }),
        ).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(getProjectState).toHaveBeenCalledTimes(2);

    projectState = ApplicationStatus.Live;
    applicationStateResolver.resolve({
      app: {
        id: mockApplication.id,
        name: mockApplication.name,
        appStates: [applicationState(ApplicationStatus.Live)],
      },
    });

    expect(
      await screen.findByText('Application content', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(getProjectState).toHaveBeenCalledTimes(3);

    projectState = ApplicationStatus.Paused;
    await queryClient.invalidateQueries({
      queryKey: [PROJECT_WITH_STATE_QUERY_KEY, mockApplication.subdomain],
    });

    expect(
      await screen.findByRole('button', { name: 'Wake up' }),
    ).toBeEnabled();
    expect(getProjectState).toHaveBeenCalledTimes(4);
  });

  it('should keep wake up disabled while the backend reports the project as paused', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );

    const getProjectState = vi.fn();
    const unpauseApplication = vi.fn();

    server.use(
      getProjectQuery,
      getApplicationStateQuery(ApplicationStatus.Paused),
      nhostGraphQLLink.query('getProjectState', () => {
        getProjectState();
        return HttpResponse.json({
          data: {
            apps: [
              {
                ...mockApplication,
                appStates: [{ stateId: ApplicationStatus.Paused }],
              },
            ],
          },
        });
      }),
      nhostGraphQLLink.mutation('UnpauseApplication', () => {
        unpauseApplication();
        return HttpResponse.json({
          data: { updateApp: { id: mockApplication.id } },
        });
      }),
    );

    render(<TestComponent />);

    const user = new TestUserEvent();
    const wakeUpButton = await screen.findByRole('button', {
      name: 'Wake up',
    });
    await user.click(wakeUpButton);

    await waitFor(() => {
      expect(unpauseApplication).toHaveBeenCalledOnce();
      expect(getProjectState).toHaveBeenCalledTimes(2);
    });
    expect(wakeUpButton).toBeDisabled();
  });

  it('should re-enable wake up when the unpause request fails', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );

    server.use(
      getProjectQuery,
      getApplicationStateQuery(ApplicationStatus.Paused),
      getProjectStateQuery([{ stateId: ApplicationStatus.Paused }]),
      nhostGraphQLLink.mutation('UnpauseApplication', () =>
        HttpResponse.json({ errors: [{ message: 'Unpause failed' }] }),
      ),
    );

    render(<TestComponent />);

    const user = new TestUserEvent();
    const wakeUpButton = await screen.findByRole('button', {
      name: 'Wake up',
    });
    await user.click(wakeUpButton);

    await waitFor(() => expect(wakeUpButton).toBeEnabled());
    toast.remove();
  });

  it('should show the free project limit message when the limit is exceeded', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    mocks.useAppPausedReason.mockReturnValue({
      isLocked: false,
      lockedReason: '',
      freeAndLiveProjectsNumberExceeded: true,
      loading: false,
    });
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Paused }]));

    render(<TestComponent />);

    expect(
      await screen.findByText(/Only 1 free project can be active at a time/),
    ).toBeInTheDocument();
  });

  it('should render the application when the state is updating', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Updating }]));
    render(<TestComponent />);

    expect(await screen.findByText('Application content')).toBeInTheDocument();

    expect(screen.queryByText('Application Unknown')).not.toBeInTheDocument();
  });

  it('should render the application when the state is live', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Live }]));
    render(<TestComponent />);

    expect(await screen.findByText('Application content')).toBeInTheDocument();

    expect(screen.queryByText('Application Unknown')).not.toBeInTheDocument();
  });

  it('should render the application when the state is migrating', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Migrating }]),
    );
    render(<TestComponent />);

    expect(await screen.findByText('Application content')).toBeInTheDocument();

    expect(screen.queryByText('Application Unknown')).not.toBeInTheDocument();
  });

  it('should render the application in an error state', async () => {
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Errored }]));
    render(<TestComponent />);

    expect(await screen.findByText('Application content')).toBeInTheDocument();

    expect(await screen.findByText(/Error deploying/)).toBeInTheDocument();

    expect(screen.queryByText('Application Unknown')).not.toBeInTheDocument();
  });

  it('should render the application in restoring state with overlay', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    server.use(getProjectQuery);
    server.use(getApplicationStateQuery(ApplicationStatus.Restoring));
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Restoring }]),
    );
    render(<TestComponent />);

    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    expect(
      await screen.findByText('Project is restoring...'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This may take a couple of minutes.'),
    ).toBeInTheDocument();
  });

  it('preserves child identity across live, restoring, and live on a non-overlay route', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject(
        '/orgs/[orgSlug]/projects/[appSubdomain]/settings/backups',
      ),
    );
    server.use(getProjectQuery);
    server.use(getApplicationStateQuery(ApplicationStatus.Restoring));
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Live }]));

    render(
      <ProjectViewWithState>
        <StatefulChild />
      </ProjectViewWithState>,
    );

    const user = new TestUserEvent();
    await user.click(await screen.findByRole('button', { name: '0' }));
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(statefulChildMountCount).toBe(1);

    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Restoring }]),
    );
    await queryClient.refetchQueries({ queryKey: ['projectWithState'] });

    await waitFor(() => {
      expect(statefulChildMountCount).toBe(1);
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    });

    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Live }]));
    await queryClient.refetchQueries({ queryKey: ['projectWithState'] });

    await waitFor(() => {
      expect(statefulChildMountCount).toBe(1);
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    });
  });

  it('blocks overlay-page children while restoring', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/database'),
    );
    server.use(getProjectQuery);
    server.use(getApplicationStateQuery(ApplicationStatus.Restoring));
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Restoring }]),
    );

    render(
      <ProjectViewWithState>
        <StatefulChild />
      </ProjectViewWithState>,
    );

    expect(
      await screen.findByText('Project is restoring...'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(statefulChildMountCount).toBe(0);
  });

  it('should clear the query cache on unmount', async () => {
    const clearSpy = vi.spyOn(queryClient, 'clear');
    mocks.useRouter.mockImplementation(() => getUseRouterObject());
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Live }]));

    const { unmount } = render(<TestComponent />);
    await screen.findByText('Application content');

    expect(clearSpy).not.toHaveBeenCalled();

    unmount();

    expect(clearSpy).toHaveBeenCalledOnce();
  });
});

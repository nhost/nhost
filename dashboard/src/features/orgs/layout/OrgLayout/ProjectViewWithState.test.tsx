import { setupServer } from 'msw/node';
import { useEffect, useState } from 'react';
import { vi } from 'vitest';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
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

const server = setupServer(tokenQuery);

describe('ProjectViewWithState', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    process.env.NEXT_PUBLIC_ENV = 'production';
    server.listen();
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
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
        desiredState: ApplicationStatus.Paused,
      }),
    );
    render(<TestComponent />);
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        'This project is paused. Unpause to make this available.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wake up' })).toBeEnabled();
    expect(
      screen.queryByText(/Only 1 free project can be active at a time/),
    ).not.toBeInTheDocument();
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
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
        desiredState: ApplicationStatus.Paused,
      }),
    );

    render(<TestComponent />);

    expect(
      await screen.findByText(/Only 1 free project can be active at a time/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wake up' })).toBeEnabled();
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

  describe.each([
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]',
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/models/[modelSlug]',
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]/queries/[querySlug]',
  ])('native-query route %s', (route) => {
    it.each([
      {
        state: ApplicationStatus.Paused,
        message: 'This project is paused. Unpause to make this available.',
      },
      {
        state: ApplicationStatus.Pausing,
        message: 'Project is pausing...',
      },
      {
        state: ApplicationStatus.Unpausing,
        message: 'Project is waking up...',
      },
      {
        state: ApplicationStatus.Restoring,
        message: 'Project is restoring...',
      },
    ])(
      'blocks child mounting while state is $state',
      async ({ state, message }) => {
        mocks.useRouter.mockImplementation(() => getUseRouterObject(route));
        server.use(
          getProjectQuery,
          getProjectStateQuery([{ stateId: state }], {
            desiredState:
              state === ApplicationStatus.Paused
                ? ApplicationStatus.Paused
                : ApplicationStatus.Live,
          }),
        );

        render(
          <ProjectViewWithState>
            <StatefulChild />
          </ProjectViewWithState>,
        );

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: '0' }),
        ).not.toBeInTheDocument();
        expect(statefulChildMountCount).toBe(0);

        if (state === ApplicationStatus.Paused) {
          expect(
            screen.getByRole('button', { name: 'Wake up' }),
          ).toBeInTheDocument();
        }
      },
    );

    it('renders children when the project is live', async () => {
      mocks.useRouter.mockImplementation(() => getUseRouterObject(route));
      server.use(
        getProjectQuery,
        getProjectStateQuery([{ stateId: ApplicationStatus.Live }]),
      );

      render(
        <ProjectViewWithState>
          <StatefulChild />
        </ProjectViewWithState>,
      );

      expect(
        await screen.findByRole('button', { name: '0' }),
      ).toBeInTheDocument();
      expect(statefulChildMountCount).toBe(1);
      expect(
        screen.queryByRole('dialog', { name: 'Project State' }),
      ).not.toBeInTheDocument();
    });
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

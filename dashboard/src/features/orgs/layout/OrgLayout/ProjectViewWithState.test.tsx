import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import ProjectViewWithState from './ProjectViewWithState';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
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

vi.mock('./ProjectStateOverlay', () => ({
  __esModule: true,
  default: ({ variant }: { variant: string }) => (
    <div data-testid="projectStateOverlay">
      Project State Overlay: {variant}
    </div>
  ),
}));

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

const server = setupServer(tokenQuery);

describe('ProjectViewWithState', () => {
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
    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(
      await screen.findByText('Project State Overlay: pausing'),
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
    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(
      await screen.findByText('Project State Overlay: unpausing'),
    ).toBeInTheDocument();
  });

  it('should render the application in paused state with overlay', async () => {
    mocks.useRouter.mockImplementation(() =>
      getUseRouterObject('/orgs/[orgSlug]/projects/[appSubdomain]/hasura'),
    );
    server.use(getProjectQuery);
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Paused }]));
    render(<TestComponent />);
    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(
      await screen.findByText('Project State Overlay: paused'),
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
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Restoring }]),
    );
    render(<TestComponent />);

    expect(await screen.findByText('Application content')).toBeInTheDocument();
    expect(
      await screen.findByText('Project State Overlay: unpausing'),
    ).toBeInTheDocument();
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

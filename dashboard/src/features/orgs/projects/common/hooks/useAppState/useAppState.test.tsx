import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import {
  getNotFoundProjectStateQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, waitFor } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import useAppState from './useAppState';

function TestComponent() {
  const { state, desiredState, project } = useAppState();

  return (
    <div>
      <h1>State: {state}</h1>
      <p>Desired state: {desiredState}</p>
      <p>Project ID: {project?.id ?? 'none'}</p>
      <p>Project name: {project?.name ?? 'none'}</p>
      <p>Project subdomain: {project?.subdomain ?? 'none'}</p>
    </div>
  );
}

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useProjectWithState: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', async () => ({
  useProject: () => ({ refetch: mocks.refetch }),
}));

const server = setupServer(tokenQuery);

describe('useAppState', () => {
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
    mocks.refetch.mockRestore();
    mocks.useProjectWithState.mockRestore();
    vi.restoreAllMocks();
  });

  it('returns empty state and refetches when the project is not found', async () => {
    server.use(getNotFoundProjectStateQuery);
    render(<TestComponent />);

    expect(await screen.findByText('State: 0')).toBeInTheDocument();
    expect(screen.getByText('Desired state: 0')).toBeInTheDocument();
    expect(screen.getByText('Project ID: none')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.refetch).toHaveBeenCalled();
    });
  });

  it('Should not refetch the project if the state is empty', async () => {
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Empty }]));
    render(<TestComponent />);
    expect(await screen.findByText('State: 0')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.refetch).not.toHaveBeenCalled();
    });
  });

  it('Should return empty state if the application state has not been filled yet', async () => {
    server.use(getProjectStateQuery([]));
    render(<TestComponent />);
    expect(await screen.findByText('State: 0')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.refetch).not.toHaveBeenCalled();
    });
  });

  it('Should return the first state and project from the response', async () => {
    server.use(
      getProjectStateQuery(
        [
          { stateId: ApplicationStatus.Live },
          { stateId: ApplicationStatus.Empty },
        ],
        {
          id: 'lifecycle-project-id',
          name: 'Lifecycle Project',
          subdomain: 'test-project',
          desiredState: ApplicationStatus.Paused,
        },
      ),
    );
    render(<TestComponent />);
    expect(await screen.findByText('State: 5')).toBeInTheDocument();
    expect(screen.getByText('Desired state: 6')).toBeInTheDocument();
    expect(
      screen.getByText('Project ID: lifecycle-project-id'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Project name: Lifecycle Project'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Project subdomain: test-project'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.refetch).not.toHaveBeenCalled();
    });
  });
});

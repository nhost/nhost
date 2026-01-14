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
  const { state } = useAppState();

  return <h1>State: {state}</h1>;
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

  it('should refetch the project, when the project is not found', async () => {
    server.use(getNotFoundProjectStateQuery);
    render(<TestComponent />);
    expect(await screen.findByText('State: 0')).toBeInTheDocument();
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

  it('Should return the first state from the response', async () => {
    server.use(
      getProjectStateQuery([
        { stateId: ApplicationStatus.Live },
        { stateId: ApplicationStatus.Empty },
      ]),
    );
    render(<TestComponent />);
    expect(await screen.findByText('State: 5')).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.refetch).not.toHaveBeenCalled();
    });
  });
});

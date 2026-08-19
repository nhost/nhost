import { vi } from 'vitest';
import { renderHook, waitFor } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import usePollWhileTransitioning from './usePollWhileTransitioning';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  useAppState: vi.fn(),
  useGetApplicationStateQuery: vi.fn(),
  useProject: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (orig) => {
  const actual = await orig<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/generated/graphql', async (orig) => {
  const actual = await orig<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetApplicationStateQuery: mocks.useGetApplicationStateQuery,
  };
});

function mockApplicationStateQuery(stateId?: ApplicationStatus) {
  mocks.useGetApplicationStateQuery.mockReturnValue({
    data: stateId
      ? { app: { appStates: [{ id: 'app-state-id', stateId }] } }
      : undefined,
    startPolling: mocks.startPolling,
    stopPolling: mocks.stopPolling,
  });
}

describe('usePollWhileTransitioning', () => {
  beforeEach(() => {
    mocks.useAppState.mockReturnValue({ state: ApplicationStatus.Restoring });
    mocks.useProject.mockReturnValue({
      project: { id: 'app-id', subdomain: 'app-subdomain' },
    });
    mockApplicationStateQuery();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ApplicationStatus.Restoring,
    ApplicationStatus.Unpausing,
    ApplicationStatus.Pausing,
  ])('polls application state while project is %s', async (state) => {
    mocks.useAppState.mockReturnValue({ state });

    renderHook(() => usePollWhileTransitioning());

    expect(mocks.useGetApplicationStateQuery).toHaveBeenCalledWith({
      variables: { appId: 'app-id' },
      skip: false,
    });

    await waitFor(() => {
      expect(mocks.startPolling).toHaveBeenCalledWith(2000);
    });
  });

  it('skips polling when project is not transitioning', async () => {
    mocks.useAppState.mockReturnValue({ state: ApplicationStatus.Live });

    renderHook(() => usePollWhileTransitioning());

    expect(mocks.useGetApplicationStateQuery).toHaveBeenCalledWith({
      variables: { appId: 'app-id' },
      skip: true,
    });
    expect(mocks.startPolling).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mocks.stopPolling).toHaveBeenCalled();
    });
  });

  it('stops polling when project leaves a transitioning state', async () => {
    let state = ApplicationStatus.Restoring;
    mocks.useAppState.mockImplementation(() => ({ state }));

    const { rerender } = renderHook(() => usePollWhileTransitioning());

    await waitFor(() => {
      expect(mocks.startPolling).toHaveBeenCalledWith(2000);
    });

    mocks.stopPolling.mockClear();
    state = ApplicationStatus.Live;
    rerender();

    expect(mocks.useGetApplicationStateQuery).toHaveBeenLastCalledWith({
      variables: { appId: 'app-id' },
      skip: true,
    });

    await waitFor(() => {
      expect(mocks.stopPolling).toHaveBeenCalled();
    });
  });

  it.each([
    ApplicationStatus.Live,
    ApplicationStatus.Paused,
    ApplicationStatus.Errored,
  ])('invalidates the project state when polling observes %s', async (state) => {
    mockApplicationStateQuery(state);

    renderHook(() => usePollWhileTransitioning());

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['projectWithState', 'app-subdomain'],
      });
    });
  });

  it.each([
    ApplicationStatus.Restoring,
    ApplicationStatus.Unpausing,
    ApplicationStatus.Pausing,
  ])('does not invalidate the project state while polling observes %s', async (state) => {
    mockApplicationStateQuery(state);

    renderHook(() => usePollWhileTransitioning());

    await waitFor(() => {
      expect(mocks.startPolling).toHaveBeenCalledWith(2000);
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
});

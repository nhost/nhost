import { vi } from 'vitest';
import { renderHook, waitFor } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import usePollWhileTransitioning from './usePollWhileTransitioning';

const mocks = vi.hoisted(() => ({
  getOrgs: vi.fn(),
  invalidateQueries: vi.fn(),
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  useAppState: vi.fn(),
  useGetApplicationStateQuery: vi.fn(),
  useGetOrganizationsLazyQuery: vi.fn(),
  useProject: vi.fn(),
  useUserData: vi.fn(),
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

vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

vi.mock('@/generated/graphql', async (orig) => {
  const actual = await orig<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetApplicationStateQuery: mocks.useGetApplicationStateQuery,
    useGetOrganizationsLazyQuery: mocks.useGetOrganizationsLazyQuery,
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
    mocks.useUserData.mockReturnValue({ id: 'user-id' });
    mocks.useGetOrganizationsLazyQuery.mockReturnValue([mocks.getOrgs]);
    mockApplicationStateQuery();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([ApplicationStatus.Restoring, ApplicationStatus.Unpausing])(
    'polls application state while project is %s',
    async (state) => {
      mocks.useAppState.mockReturnValue({ state });

      renderHook(() => usePollWhileTransitioning());

      expect(mocks.useGetApplicationStateQuery).toHaveBeenCalledWith({
        variables: { appId: 'app-id' },
        skip: false,
      });

      await waitFor(() => {
        expect(mocks.startPolling).toHaveBeenCalledWith(2000);
      });
    },
  );

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

  it.each([ApplicationStatus.Live, ApplicationStatus.Errored])(
    'refreshes organizations and project state when polling observes %s',
    async (state) => {
      mockApplicationStateQuery(state);

      renderHook(() => usePollWhileTransitioning());

      await waitFor(() => {
        expect(mocks.getOrgs).toHaveBeenCalledWith({
          variables: { userId: 'user-id' },
        });
        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['projectWithState', 'app-subdomain'],
        });
      });
    },
  );

  it.each([ApplicationStatus.Restoring, ApplicationStatus.Unpausing])(
    'does not refresh organizations while polling observes %s',
    async (state) => {
      mockApplicationStateQuery(state);

      renderHook(() => usePollWhileTransitioning());

      await waitFor(() => {
        expect(mocks.startPolling).toHaveBeenCalledWith(2000);
      });
      expect(mocks.getOrgs).not.toHaveBeenCalled();
      expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    },
  );
});

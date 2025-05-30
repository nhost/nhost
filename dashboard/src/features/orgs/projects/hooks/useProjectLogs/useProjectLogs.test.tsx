import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useProjectLogs,
  type UseProjectLogsProps,
} from '@/features/orgs/projects/hooks/useProjectLogs';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { useRemoteApplicationGQLClientWithSubscriptions } from '@/hooks/useRemoteApplicationGQLClientWithSubscriptions';
import { mockApplication as mockProject } from '@/tests/mocks';
import { renderHook } from '@/tests/testUtils';
import { useGetProjectLogsQuery } from '@/utils/__generated__/graphql';
import { InMemoryCache } from '@apollo/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies
vi.mock('@/features/orgs/projects/hooks/useProject');
vi.mock('@/hooks/useRemoteApplicationGQLClientWithSubscriptions');
vi.mock('@/utils/__generated__/graphql', async () => {
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetProjectLogsQuery: vi.fn(),
    GetLogsSubscriptionDocument: 'GetLogsSubscriptionDocument',
  };
});

const mockUseProject = vi.mocked(useProject);
const mockUseRemoteApplicationGQLClientWithSubscriptions = vi.mocked(
  useRemoteApplicationGQLClientWithSubscriptions,
);
const mockUseGetProjectLogsQuery = vi.mocked(useGetProjectLogsQuery);

type ProjectLogsReturnType = ReturnType<typeof useGetProjectLogsQuery>;
type SubscribeToMore = ProjectLogsReturnType['subscribeToMore'];

describe('useProjectLogs - Subscription Creation Logic & Cleanup', () => {
  const createMockApolloClient = () => ({
    query: vi.fn(),
    mutate: vi.fn(),
    watchQuery: vi.fn(),
    readQuery: vi.fn(),
    writeQuery: vi.fn(),
    readFragment: vi.fn(),
    writeFragment: vi.fn(),
    cache: new InMemoryCache(),
    link: {},
    version: '3.0.0',
    addResolvers: vi.fn(),
    setResolvers: vi.fn(),
    getResolvers: vi.fn(),
    setLocalStateFragmentMatcher: vi.fn(),
    setLink: vi.fn(),
    resetStore: vi.fn(),
    clearStore: vi.fn(),
    onResetStore: vi.fn(),
    onClearStore: vi.fn(),
    reFetchObservableQueries: vi.fn(),
    refetchQueries: vi.fn(),
    getObservableQueries: vi.fn(),
    extract: vi.fn(),
    restore: vi.fn(),
    addTypename: true,
    defaultOptions: {},
    disableNetworkFetches: false,
    queryDeduplication: true,
    stop: vi.fn(),
    getStats: vi.fn(),
    localState: {},
    queryManager: {} as any,
    typeDefs: undefined,
  });

  let mockClient: ReturnType<typeof createMockApolloClient>;

  const mockSubscribeToMore = vi.fn();
  const mockUnsubscribe = vi.fn();

  const defaultProps: UseProjectLogsProps = {
    from: new Date('2023-01-01').toISOString(),
    to: null, // Real-time mode
    service: AvailableLogsService.ALL,
    regexFilter: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useProject to return a project
    mockUseProject.mockReturnValue({
      project: mockProject,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    });

    mockClient = createMockApolloClient();

    // Mock the GraphQL client
    mockUseRemoteApplicationGQLClientWithSubscriptions.mockReturnValue(
      mockClient as any,
    );

    // Mock subscribeToMore to return an unsubscribe function
    mockSubscribeToMore.mockReturnValue(mockUnsubscribe);

    // Mock useGetProjectLogsQuery
    mockUseGetProjectLogsQuery.mockReturnValue({
      loading: false,
      subscribeToMore: mockSubscribeToMore as SubscribeToMore,
    } as ProjectLogsReturnType);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Subscription Creation Logic', () => {
    it('should create subscription when props.to is null (real-time mode)', () => {
      const props = { ...defaultProps, to: null };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: AvailableLogsService.ALL,
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });

    it('should not create subscription when props.to has a value (historical mode)', () => {
      const props = {
        ...defaultProps,
        to: new Date('2023-01-02').toISOString(), // Historical mode
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when project is loading', () => {
      mockUseProject.mockReturnValue({
        project: mockProject,
        loading: true, // Project is loading
        error: undefined,
        refetch: vi.fn(),
      });

      renderHook(() => useProjectLogs(defaultProps));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when project is null', () => {
      mockUseProject.mockReturnValue({
        project: null, // No project
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderHook(() => useProjectLogs(defaultProps));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should handle JOB_BACKUP service with regex pattern', () => {
      const props = {
        ...defaultProps,
        service: AvailableLogsService.JOB_BACKUP,
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: 'job-backup.+', // Should be converted to regex pattern
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });

    it('should pass through other service names unchanged', () => {
      const props = {
        ...defaultProps,
        service: AvailableLogsService.POSTGRES,
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: AvailableLogsService.POSTGRES, // Should remain unchanged
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });
  });

  describe('Subscription Cleanup', () => {
    it('should unsubscribe existing subscription when switching from real-time to historical mode', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, to: null }, // Start in real-time mode
        },
      });

      // Verify subscription was created
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      // Switch to historical mode
      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-02').toISOString(), // Switch to historical mode
        },
      });

      // Should unsubscribe the existing subscription
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clean up subscription when props change in real-time mode', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, service: AvailableLogsService.ALL },
        },
      });

      // Verify initial subscription was created
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      // Change service while staying in real-time mode
      rerender({
        props: {
          ...defaultProps,
          service: AvailableLogsService.POSTGRES,
        },
      });

      // Should unsubscribe old and create new subscription
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(2);
    });

    it('should clean up subscription on component unmount', () => {
      const { unmount } = renderHook(() => useProjectLogs(defaultProps));

      // Verify subscription was created
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      // Unmount component
      unmount();

      // Should unsubscribe
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe old subscription before creating new one', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: {
            ...defaultProps,
            from: new Date('2023-01-01').toISOString(),
          },
        },
      });

      // Verify initial subscription
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      // Change the from date
      rerender({
        props: {
          ...defaultProps,
          from: new Date('2023-01-02').toISOString(),
        },
      });

      // Should unsubscribe old subscription first, then create new one
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid prop changes without creating multiple subscriptions', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, regexFilter: 'filter1' },
        },
      });

      // Initial subscription
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      // Rapid changes
      rerender({ props: { ...defaultProps, regexFilter: 'filter2' } });
      rerender({ props: { ...defaultProps, regexFilter: 'filter3' } });
      rerender({ props: { ...defaultProps, regexFilter: 'filter4' } });

      // Should have unsubscribed 3 times (for each change) and subscribed 4 times total
      expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(4);
    });

    it('should not create subscription when switching back to historical mode after cleanup', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, to: null }, // Real-time mode
        },
      });

      // Switch to historical mode
      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-02'),
        },
      });

      // Switch to another historical date
      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-03'),
        },
      });

      // Should have only created one subscription initially, then cleaned it up
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});

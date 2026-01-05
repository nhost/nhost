import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { mockApplication as mockProject } from '@/tests/mocks';
import { renderHook } from '@/tests/testUtils';
import { useGetProjectLogsQuery } from '@/utils/__generated__/graphql';
import { InMemoryCache } from '@apollo/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useProjectLogs, { type UseProjectLogsProps } from './useProjectLogs';

// Mock the dependencies
vi.mock('@/features/orgs/projects/hooks/useProject');
vi.mock('@/utils/splitGraphqlClient', () => ({
  splitGraphqlClient: {
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
    // biome-ignore lint/suspicious/noExplicitAny: test file
    queryManager: {} as any,
    typeDefs: undefined,
  },
}));

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetProjectLogsQuery: vi.fn(),
    GetLogsSubscriptionDocument: 'GetLogsSubscriptionDocument',
  };
});

const mockUseProject = vi.mocked(useProject);
const mockUseGetProjectLogsQuery = vi.mocked(useGetProjectLogsQuery);

type ProjectLogsReturnType = ReturnType<typeof useGetProjectLogsQuery>;
type SubscribeToMore = ProjectLogsReturnType['subscribeToMore'];

describe('useProjectLogs - Subscription Creation & Cleanup', () => {
  const mockSubscribeToMore = vi.fn();
  const mockUnsubscribe = vi.fn();

  const defaultProps: UseProjectLogsProps = {
    from: new Date('2023-01-01').toISOString(),
    to: null, // Real-time mode
    service: CoreLogService.ALL,
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
      projectNotFound: false,
    });

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

  describe('Subscription Creation', () => {
    it('should create subscription when props.to is null', () => {
      const props = { ...defaultProps, to: null };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: CoreLogService.ALL,
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });

    it('should not create subscription when props.to has a value', () => {
      const props = {
        ...defaultProps,
        to: new Date('2023-01-02').toISOString(),
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when project is loading', () => {
      mockUseProject.mockReturnValue({
        project: mockProject,
        loading: true,
        error: undefined,
        refetch: vi.fn(),
        projectNotFound: false,
      });

      renderHook(() => useProjectLogs(defaultProps));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when project is null', () => {
      mockUseProject.mockReturnValue({
        project: null,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
        projectNotFound: false,
      });

      renderHook(() => useProjectLogs(defaultProps));

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Cleanup', () => {
    it('should unsubscribe existing subscription when switching from real-time to historical mode', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, to: null },
          // biome-ignore lint/suspicious/noExplicitAny: test file
        } as any,
      });

      // Verify subscription was created
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-02').toISOString(),
        },
      });

      // Should unsubscribe the existing subscription
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clean up subscription when change to live', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, service: CoreLogService.ALL },
        },
      });

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({
        props: {
          ...defaultProps,
          service: CoreLogService.POSTGRES,
        },
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(2);
    });

    it('should clean up subscription on component unmount', () => {
      const { unmount } = renderHook(() => useProjectLogs(defaultProps));

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      unmount();

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

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({
        props: {
          ...defaultProps,
          from: new Date('2023-01-02').toISOString(),
        },
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid prop changes without creating multiple subscriptions', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, regexFilter: 'filter1' },
        },
      });

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({ props: { ...defaultProps, regexFilter: 'filter2' } });
      rerender({ props: { ...defaultProps, regexFilter: 'filter3' } });
      rerender({ props: { ...defaultProps, regexFilter: 'filter4' } });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(4);
    });

    it('should not create subscription when switching back from live', () => {
      const { rerender } = renderHook(({ props }) => useProjectLogs(props), {
        initialProps: {
          props: { ...defaultProps, to: null },
          // biome-ignore lint/suspicious/noExplicitAny: test file
        } as any,
      });

      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-02'),
        },
      });

      rerender({
        props: {
          ...defaultProps,
          to: new Date('2023-01-03'),
        },
      });

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handling service change', () => {
    it('should handle JOB_BACKUP service with regex pattern', () => {
      const props = {
        ...defaultProps,
        service: CoreLogService.JOB_BACKUP,
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: 'job-backup.+',
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });

    it('should pass through other service names unchanged', () => {
      const props = {
        ...defaultProps,
        service: CoreLogService.POSTGRES,
      };

      renderHook(() => useProjectLogs(props));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetLogsSubscriptionDocument',
        variables: {
          appID: mockProject.id,
          service: CoreLogService.POSTGRES, // Should remain unchanged
          from: props.from,
          regexFilter: props.regexFilter,
        },
        updateQuery: expect.any(Function),
      });
    });
  });
});

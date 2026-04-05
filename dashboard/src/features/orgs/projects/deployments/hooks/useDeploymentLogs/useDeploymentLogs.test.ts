import { InMemoryCache } from '@apollo/client';
import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import { useGetPipelineRunLogsQuery } from '@/utils/__generated__/graphql';
import useDeploymentLogs, {
  type UseDeploymentLogsProps,
} from './useDeploymentLogs';

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
    useGetPipelineRunLogsQuery: vi.fn(),
    GetPipelineRunLogsSubscriptionDocument:
      'GetPipelineRunLogsSubscriptionDocument',
  };
});

const mockUseGetPipelineRunLogsQuery = vi.mocked(useGetPipelineRunLogsQuery);

type QueryReturnType = ReturnType<typeof useGetPipelineRunLogsQuery>;
type SubscribeToMore = QueryReturnType['subscribeToMore'];

describe('useDeploymentLogs', () => {
  const mockSubscribeToMore = vi.fn();
  const mockUnsubscribe = vi.fn();

  const defaultProps: UseDeploymentLogsProps = {
    appID: 'test-app-id',
    pipelineRunID: 'test-run-id',
    status: 'running',
    startedAt: '2024-01-01T10:00:00Z',
    endedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSubscribeToMore.mockReturnValue(mockUnsubscribe);

    mockUseGetPipelineRunLogsQuery.mockReturnValue({
      loading: false,
      subscribeToMore: mockSubscribeToMore as SubscribeToMore,
    } as QueryReturnType);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscription creation', () => {
    it('should create subscription when status is running', () => {
      renderHook(() => useDeploymentLogs(defaultProps));

      expect(mockSubscribeToMore).toHaveBeenCalledWith({
        document: 'GetPipelineRunLogsSubscriptionDocument',
        variables: {
          appID: defaultProps.appID,
          pipelineRunID: defaultProps.pipelineRunID,
          from: defaultProps.startedAt,
        },
        updateQuery: expect.any(Function),
      });
    });

    it('should create subscription when status is pending', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, status: 'pending' }),
      );

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
    });

    it('should not create subscription when status is succeeded', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, status: 'succeeded' }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when status is failed', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, status: 'failed' }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should not create subscription when status is aborted', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, status: 'aborted' }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });
  });

  describe('skip conditions', () => {
    it('should skip when appID is undefined', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, appID: undefined }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should skip when pipelineRunID is undefined', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, pipelineRunID: undefined }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should skip when startedAt is undefined', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, startedAt: undefined }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });

    it('should skip when startedAt is null', () => {
      renderHook(() =>
        useDeploymentLogs({ ...defaultProps, startedAt: null }),
      );

      expect(mockSubscribeToMore).not.toHaveBeenCalled();
    });
  });

  describe('subscription cleanup', () => {
    it('should clean up subscription on unmount', () => {
      const { unmount } = renderHook(() => useDeploymentLogs(defaultProps));

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should clean up and recreate subscription when props change', () => {
      const { rerender } = renderHook(
        ({ props }) => useDeploymentLogs(props),
        {
          initialProps: { props: defaultProps },
        },
      );

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({
        props: {
          ...defaultProps,
          startedAt: '2024-01-02T10:00:00Z',
        },
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(2);
    });

    it('should not create subscription when status changes to succeeded', () => {
      const { rerender } = renderHook(
        ({ props }) => useDeploymentLogs(props),
        {
          initialProps: { props: defaultProps },
        },
      );

      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

      rerender({
        props: { ...defaultProps, status: 'succeeded' },
      });

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
    });
  });
});

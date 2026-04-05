import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import {
  useGetLegacyDeploymentQuery,
  useGetPipelineRunQuery,
} from '@/utils/__generated__/graphql';

import useDeployment from './useDeployment';

// Mock the GraphQL hooks
const mockSubscribeToMore = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetPipelineRunQuery: vi.fn(),
    useGetLegacyDeploymentQuery: vi.fn(),
    PipelineRunSubDocument: 'PipelineRunSubDocument',
  };
});

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { deploymentId: 'test-deployment-id' },
  }),
}));

const mockUseGetPipelineRunQuery = vi.mocked(useGetPipelineRunQuery);
const mockUseGetLegacyDeploymentQuery = vi.mocked(useGetLegacyDeploymentQuery);

// biome-ignore lint/suspicious/noExplicitAny: test file
const legacyQueryResult: any = {
  data: undefined,
  loading: false,
  error: null,
};

describe('useDeployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToMore.mockReturnValue(mockUnsubscribe);
    mockUseGetLegacyDeploymentQuery.mockReturnValue(legacyQueryResult);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockQueryResult = (status: string) =>
    ({
      data: {
        pipelineRun: {
          status,
        },
      },
      subscribeToMore: mockSubscribeToMore,
      loading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test file
    }) as any;

  it('should start subscription when status is pending', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('pending'),
    );

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledWith({
      document: 'PipelineRunSubDocument',
      variables: {
        id: 'test-deployment-id',
      },
    });
  });

  it('should start subscription when status is running', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('running'),
    );

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledWith({
      document: 'PipelineRunSubDocument',
      variables: {
        id: 'test-deployment-id',
      },
    });
  });

  it('should not start subscription when status is succeeded', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('succeeded'),
    );

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should not start subscription when status is failed', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(createMockQueryResult('failed'));

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should cleanup subscription when status changes from pending to succeeded', () => {
    const { rerender } = renderHook(() => useDeployment());

    // Initially pending - should start subscription
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('pending'),
    );
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Status changes to succeeded - should cleanup subscription
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('succeeded'),
    );
    rerender();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscription when status changes from running to failed', () => {
    const { rerender } = renderHook(() => useDeployment());

    // Initially running - should start subscription
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('running'),
    );
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Status changes to failed - should cleanup subscription
    mockUseGetPipelineRunQuery.mockReturnValue(createMockQueryResult('failed'));
    rerender();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should not create duplicate subscriptions when already subscribed', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('pending'),
    );

    const { rerender } = renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Re-render with same status - should not create new subscription
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscription on component unmount', () => {
    mockUseGetPipelineRunQuery.mockReturnValue(
      createMockQueryResult('pending'),
    );

    const { unmount } = renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should handle missing pipeline run data gracefully', () => {
    mockUseGetPipelineRunQuery.mockReturnValue({
      data: undefined,
      subscribeToMore: mockSubscribeToMore,
      loading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test file
    } as any);

    expect(() => renderHook(() => useDeployment())).not.toThrow();
    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should return query result with legacy deployment fields', () => {
    const mockResult = createMockQueryResult('succeeded');
    mockUseGetPipelineRunQuery.mockReturnValue(mockResult);

    const { result } = renderHook(() => useDeployment());

    expect(result.current.data).toEqual(mockResult.data);
    expect(result.current.loading).toEqual(mockResult.loading);
    expect(result.current.error).toEqual(mockResult.error);
    expect(result.current.legacyDeployment).toBeNull();
    expect(result.current.legacyLoading).toBe(false);
    expect(result.current).not.toHaveProperty('subscribeToMore');
  });
});

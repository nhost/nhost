import { renderHook } from '@/tests/testUtils';
import { useGetDeploymentQuery } from '@/utils/__generated__/graphql';
import { vi } from 'vitest';

import useDeployment from './useDeployment';

// Mock the GraphQL hook
const mockSubscribeToMore = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('@/utils/__generated__/graphql', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test file
  const actual = await vi.importActual<any>('@/utils/__generated__/graphql');
  return {
    ...actual,
    useGetDeploymentQuery: vi.fn(),
    DeploymentSubDocument: 'DeploymentSubDocument',
  };
});

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { deploymentId: 'test-deployment-id' },
  }),
}));

const mockUseGetDeploymentQuery = vi.mocked(useGetDeploymentQuery);

describe('useDeployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToMore.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockQueryResult = (deploymentStatus: string) =>
    ({
      data: {
        deployment: {
          deploymentStatus,
        },
      },
      subscribeToMore: mockSubscribeToMore,
      loading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test file
    }) as any;

  it('should start subscription when deployment status is PENDING', () => {
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('PENDING'));

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledWith({
      document: 'DeploymentSubDocument',
      variables: {
        id: 'test-deployment-id',
      },
    });
  });

  it('should start subscription when deployment status is SCHEDULED', () => {
    mockUseGetDeploymentQuery.mockReturnValue(
      createMockQueryResult('SCHEDULED'),
    );

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledWith({
      document: 'DeploymentSubDocument',
      variables: {
        id: 'test-deployment-id',
      },
    });
  });

  it('should not start subscription when deployment status is DEPLOYED', () => {
    mockUseGetDeploymentQuery.mockReturnValue(
      createMockQueryResult('DEPLOYED'),
    );

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should not start subscription when deployment status is FAILED', () => {
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('FAILED'));

    renderHook(() => useDeployment());

    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should cleanup subscription when status changes from PENDING to DEPLOYED', () => {
    const { rerender } = renderHook(() => useDeployment());

    // Initially PENDING - should start subscription
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('PENDING'));
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Status changes to DEPLOYED - should cleanup subscription
    mockUseGetDeploymentQuery.mockReturnValue(
      createMockQueryResult('DEPLOYED'),
    );
    rerender();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscription when status changes from SCHEDULED to FAILED', () => {
    const { rerender } = renderHook(() => useDeployment());

    // Initially SCHEDULED - should start subscription
    mockUseGetDeploymentQuery.mockReturnValue(
      createMockQueryResult('SCHEDULED'),
    );
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Status changes to FAILED - should cleanup subscription
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('FAILED'));
    rerender();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should not create duplicate subscriptions when already subscribed', () => {
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('PENDING'));

    const { rerender } = renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    // Re-render with same status - should not create new subscription
    rerender();

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);
  });

  it('should cleanup subscription on component unmount', () => {
    mockUseGetDeploymentQuery.mockReturnValue(createMockQueryResult('PENDING'));

    const { unmount } = renderHook(() => useDeployment());

    expect(mockSubscribeToMore).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should handle missing deployment data gracefully', () => {
    mockUseGetDeploymentQuery.mockReturnValue({
      data: undefined,
      subscribeToMore: mockSubscribeToMore,
      loading: false,
      error: null,
      // biome-ignore lint/suspicious/noExplicitAny: test file
    } as any);

    expect(() => renderHook(() => useDeployment())).not.toThrow();
    expect(mockSubscribeToMore).not.toHaveBeenCalled();
  });

  it('should return query result excluding subscribeToMore', () => {
    const mockResult = createMockQueryResult('DEPLOYED');
    mockUseGetDeploymentQuery.mockReturnValue(mockResult);

    const { result } = renderHook(() => useDeployment());

    expect(result.current).toEqual({
      data: mockResult.data,
      loading: mockResult.loading,
      error: mockResult.error,
    });
    expect(result.current).not.toHaveProperty('subscribeToMore');
  });
});

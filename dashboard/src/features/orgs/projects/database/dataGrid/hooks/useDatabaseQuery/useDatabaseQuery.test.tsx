import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import useDatabaseQuery from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery/useDatabaseQuery';
import { renderHook } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  fetchDatabase: vi.fn(),
  useProject: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery/fetchDatabase',
  () => ({ default: mocks.fetchDatabase }),
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDatabaseQuery', () => {
  beforeEach(() => {
    queryClient.clear();
    mocks.fetchDatabase.mockReset();
    mocks.useRouter.mockReturnValue({
      query: { dataSourceSlug: 'default' },
      isReady: true,
    });
  });

  it('does not execute when the project config is unavailable', () => {
    mocks.useProject.mockReturnValue({
      project: {
        subdomain: 'test-app',
        region: { name: 'us-east-1', domain: 'nhost.run' },
        config: null,
      },
    });

    const { result } = renderHook(() => useDatabaseQuery(['database']), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mocks.fetchDatabase).not.toHaveBeenCalled();
  });
});

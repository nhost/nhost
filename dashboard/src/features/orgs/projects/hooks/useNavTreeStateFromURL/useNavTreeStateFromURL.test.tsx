import type { NextRouter } from 'next/router';
import { vi } from 'vitest';
import { useNavTreeStateFromURL } from '@/features/orgs/projects/hooks/useNavTreeStateFromURL';
import { mockRouter } from '@/tests/mocks';
import { renderHook } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function mockRouterState(asPath: string, query: NextRouter['query']) {
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    asPath,
    query,
  } satisfies NextRouter);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useNavTreeStateFromURL', () => {
  it('focuses the org page matching the URL', () => {
    mockRouterState('/orgs/xyz/billing', { orgSlug: 'xyz' });

    const { result } = renderHook(() => useNavTreeStateFromURL());

    expect(result.current.focusedItem).toBe('xyz-billing');
  });

  it('focuses the org page when the URL has query params', () => {
    mockRouterState('/orgs/xyz/billing?tab=usage', {
      orgSlug: 'xyz',
      tab: 'usage',
    });

    const { result } = renderHook(() => useNavTreeStateFromURL());

    expect(result.current.focusedItem).toBe('xyz-billing');
  });

  it('focuses the project page when the URL has query params', () => {
    mockRouterState('/orgs/xyz/projects/test-project/deployments?page=2', {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      page: '2',
    });

    const { result } = renderHook(() => useNavTreeStateFromURL());

    expect(result.current.focusedItem).toBe('xyz-test-project-deployments');
  });
});

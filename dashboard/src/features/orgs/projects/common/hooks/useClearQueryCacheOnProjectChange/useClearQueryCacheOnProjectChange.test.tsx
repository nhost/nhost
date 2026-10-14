import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import useClearQueryCacheOnProjectChange from './useClearQueryCacheOnProjectChange';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function setAppSubdomain(appSubdomain?: string) {
  mocks.useRouter.mockReturnValue({
    query: appSubdomain ? { orgSlug: 'xyz', appSubdomain } : { orgSlug: 'xyz' },
  });
}

function renderClearHook() {
  const queryClient = new QueryClient();
  const clearSpy = vi.spyOn(queryClient, 'clear');

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  const result = renderHook(() => useClearQueryCacheOnProjectChange(), {
    wrapper: Wrapper,
  });

  return { ...result, clearSpy };
}

describe('useClearQueryCacheOnProjectChange', () => {
  afterEach(() => {
    mocks.useRouter.mockReset();
  });

  it('keeps the cache while the project stays the same', () => {
    setAppSubdomain('project-a');
    const { rerender, clearSpy } = renderClearHook();

    rerender();

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('clears the cache when switching to another project', () => {
    setAppSubdomain('project-a');
    const { rerender, clearSpy } = renderClearHook();

    setAppSubdomain('project-b');
    rerender();

    expect(clearSpy).toHaveBeenCalledOnce();
  });

  it('clears the cache on unmount', () => {
    setAppSubdomain('project-a');
    const { unmount, clearSpy } = renderClearHook();

    unmount();

    expect(clearSpy).toHaveBeenCalledOnce();
  });

  it('does not clear the cache when the project subdomain first resolves', () => {
    setAppSubdomain();
    const { rerender, clearSpy } = renderClearHook();

    setAppSubdomain('project-a');
    rerender();

    expect(clearSpy).not.toHaveBeenCalled();
  });
});

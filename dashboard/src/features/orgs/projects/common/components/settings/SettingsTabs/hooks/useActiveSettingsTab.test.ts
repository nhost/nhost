import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import useActiveSettingsTab from './useActiveSettingsTab';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const PATHNAME = '/orgs/[orgSlug]/projects/[appSubdomain]/storage/settings';

const TABS = { storage: {}, 'rate-limiting': {} };

function setRouter(tab?: string | string[], { isReady = true } = {}) {
  const router = {
    pathname: PATHNAME,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project', tab },
    isReady,
    replace: vi.fn().mockResolvedValue(true),
  };
  mocks.useRouter.mockReturnValue(router);

  return router;
}

describe('useActiveSettingsTab', () => {
  it('returns the requested tab without correcting the URL', () => {
    const router = setRouter('rate-limiting');

    const { result } = renderHook(() => useActiveSettingsTab(TABS, 'storage'));

    expect(result.current).toBe('rate-limiting');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing', undefined],
    ['an unknown', 'unknown'],
    ['an inherited object property as', 'toString'],
  ])('returns the default tab for %s tab and corrects the URL', (_, tab) => {
    const router = setRouter(tab);

    const { result } = renderHook(() => useActiveSettingsTab(TABS, 'storage'));

    expect(result.current).toBe('storage');
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      { pathname: PATHNAME, query: { ...router.query, tab: 'storage' } },
      undefined,
      { shallow: true },
    );
  });

  it('returns the first value of a repeated tab query parameter', () => {
    const router = setRouter(['rate-limiting', 'storage']);

    const { result } = renderHook(() => useActiveSettingsTab(TABS, 'storage'));

    expect(result.current).toBe('rate-limiting');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns nothing and keeps the URL until the router is ready', () => {
    const router = setRouter(undefined, { isReady: false });

    const { result } = renderHook(() => useActiveSettingsTab(TABS, 'storage'));

    expect(result.current).toBeUndefined();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

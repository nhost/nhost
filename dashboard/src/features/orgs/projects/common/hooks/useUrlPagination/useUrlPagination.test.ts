import { vi } from 'vitest';
import { act, renderHook } from '@/tests/testUtils';
import useUrlPagination, { getPageNumberFromQuery } from './useUrlPagination';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

describe('getPageNumberFromQuery', () => {
  it.each<[string | string[] | undefined, number]>([
    [undefined, 1],
    ['', 1],
    ['abc', 1],
    ['0', 1],
    ['-5', 1],
    ['1', 1],
    ['2', 2],
    ['10', 10],
    ['3.9', 3],
    [['2', '3'], 2],
  ])('maps %o to page %i', (input, expected) => {
    expect(getPageNumberFromQuery(input)).toBe(expected);
  });
});

const PATHNAME = '/orgs/[orgSlug]/projects/[appSubdomain]/auth/users';

function createRouter(query: Record<string, string> = { orgSlug: 'xyz' }) {
  return {
    pathname: PATHNAME,
    query,
    push: vi.fn(),
    replace: vi.fn(),
  };
}

function renderPagination(
  options: Partial<Parameters<typeof useUrlPagination>[0]> = {},
  router = createRouter(),
) {
  mocks.useRouter.mockReturnValue(router);

  const { result } = renderHook(() =>
    useUrlPagination({
      currentPage: 1,
      elementsPerPage: 25,
      totalNrOfElements: 0,
      loading: false,
      ...options,
    }),
  );

  return { result, router };
}

describe('useUrlPagination', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each<[number, number, number]>([
    [0, 25, 1],
    [25, 25, 1],
    [26, 25, 2],
    [100, 25, 4],
  ])(
    'reports %i elements at %i per page as %i pages',
    (totalNrOfElements, elementsPerPage, expected) => {
      const { result } = renderPagination({
        totalNrOfElements,
        elementsPerPage,
      });

      expect(result.current.nrOfPages).toBe(expected);
    },
  );

  it('pushes the target page number when navigating to a page > 1', () => {
    const { result, router } = renderPagination();

    act(() => result.current.goToPage(3));

    expect(router.push).toHaveBeenCalledWith({
      pathname: PATHNAME,
      query: { orgSlug: 'xyz', page: '3' },
    });
  });

  it('drops the page param when navigating to page 1', () => {
    const { result, router } = renderPagination(
      { currentPage: 3, totalNrOfElements: 100 },
      createRouter({ orgSlug: 'xyz', page: '3' }),
    );

    act(() => result.current.goToPage(1));

    expect(router.push).toHaveBeenCalledWith({
      pathname: PATHNAME,
      query: { orgSlug: 'xyz' },
    });
  });

  it('goToNextPage pushes currentPage + 1', () => {
    const { result, router } = renderPagination({
      currentPage: 2,
      totalNrOfElements: 100,
    });

    act(() => result.current.goToNextPage());

    expect(router.push).toHaveBeenCalledWith({
      pathname: PATHNAME,
      query: { orgSlug: 'xyz', page: '3' },
    });
  });

  it('goToPreviousPage from page 1 drops the page param', () => {
    const { result, router } = renderPagination({
      currentPage: 1,
      totalNrOfElements: 100,
    });

    act(() => result.current.goToPreviousPage());

    expect(router.push).toHaveBeenCalledWith({
      pathname: PATHNAME,
      query: { orgSlug: 'xyz' },
    });
  });

  it('replaces an out-of-range page with the last page once loaded', () => {
    const { router } = renderPagination(
      { currentPage: 5, totalNrOfElements: 100, loading: false },
      createRouter({ orgSlug: 'xyz', page: '5' }),
    );

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: PATHNAME,
      query: { orgSlug: 'xyz', page: '4' },
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('does not clamp an out-of-range page while loading', () => {
    const { router } = renderPagination(
      { currentPage: 5, totalNrOfElements: 100, loading: true },
      createRouter({ orgSlug: 'xyz', page: '5' }),
    );

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not clamp when there are no elements', () => {
    const { router } = renderPagination({
      currentPage: 5,
      totalNrOfElements: 0,
      loading: false,
    });

    expect(router.replace).not.toHaveBeenCalled();
  });
});

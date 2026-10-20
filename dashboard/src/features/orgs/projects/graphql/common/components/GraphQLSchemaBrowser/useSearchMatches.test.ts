import { vi } from 'vitest';
import { act, renderHook } from '@/tests/testUtils';
import type { SchemaSearchResult } from './types';
import useSearchMatches from './useSearchMatches';

const MATCHES = ['a', 'b', 'c'];

function renderSearchMatches() {
  const show = vi.fn();
  const { result } = renderHook(() => useSearchMatches<string>(show));

  return { show, result };
}

describe('useSearchMatches', () => {
  it('starts at the first match and shows it', () => {
    const { show, result } = renderSearchMatches();

    let searchResult: SchemaSearchResult | null = null;
    act(() => {
      searchResult = result.current.start(MATCHES);
    });

    expect(searchResult).toEqual({ count: 3, index: 0 });
    expect(show).toHaveBeenLastCalledWith(MATCHES, 0);
  });

  it('steps forward and wraps around after the last match', () => {
    const { show, result } = renderSearchMatches();

    act(() => {
      result.current.start(MATCHES);
    });

    let searchResult: SchemaSearchResult | null = null;
    act(() => {
      searchResult = result.current.next();
    });

    expect(searchResult).toEqual({ count: 3, index: 1 });
    expect(show).toHaveBeenLastCalledWith(MATCHES, 1);

    act(() => {
      result.current.next();
    });
    act(() => {
      searchResult = result.current.next();
    });

    expect(searchResult).toEqual({ count: 3, index: 0 });
    expect(show).toHaveBeenLastCalledWith(MATCHES, 0);
  });

  it('steps backward and wraps around before the first match', () => {
    const { show, result } = renderSearchMatches();

    act(() => {
      result.current.start(MATCHES);
    });

    let searchResult: SchemaSearchResult | null = null;
    act(() => {
      searchResult = result.current.previous();
    });

    expect(searchResult).toEqual({ count: 3, index: 2 });
    expect(show).toHaveBeenLastCalledWith(MATCHES, 2);
  });

  it('restarts from the first match of a new search', () => {
    const { show, result } = renderSearchMatches();

    act(() => {
      result.current.start(MATCHES);
    });
    act(() => {
      result.current.next();
    });

    let searchResult: SchemaSearchResult | null = null;
    act(() => {
      searchResult = result.current.start(['x', 'y']);
    });

    expect(searchResult).toEqual({ count: 2, index: 0 });
    expect(show).toHaveBeenLastCalledWith(['x', 'y'], 0);
  });

  it('shows an empty result, so old matches can be cleared', () => {
    const { show, result } = renderSearchMatches();

    act(() => {
      result.current.start(MATCHES);
    });

    let searchResult: SchemaSearchResult | null = null;
    act(() => {
      searchResult = result.current.start([]);
    });

    expect(searchResult).toEqual({ count: 0, index: 0 });
    expect(show).toHaveBeenLastCalledWith([], 0);
  });

  it('clears the matches and shows an empty result', () => {
    const { show, result } = renderSearchMatches();

    act(() => {
      result.current.start(MATCHES);
    });
    act(() => {
      result.current.clear();
    });

    expect(show).toHaveBeenLastCalledWith([], 0);
    expect(result.current.next()).toBeNull();
  });

  it('does not step without matches', () => {
    const { show, result } = renderSearchMatches();

    expect(result.current.next()).toBeNull();
    expect(result.current.previous()).toBeNull();
    expect(show).not.toHaveBeenCalled();

    act(() => {
      result.current.start([]);
    });
    show.mockClear();

    expect(result.current.next()).toBeNull();
    expect(result.current.previous()).toBeNull();
    expect(show).not.toHaveBeenCalled();
  });
});

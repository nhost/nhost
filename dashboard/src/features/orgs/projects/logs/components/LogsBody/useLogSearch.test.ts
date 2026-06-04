import { useLogSearch } from '@/features/orgs/projects/logs/components/LogsBody/useLogSearch';
import { act, renderHook } from '@/tests/testUtils';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';

const entry = (timestamp: string, log: string, service = 'hasura'): LogEntry => ({
  timestamp,
  service,
  log,
});

describe('useLogSearch', () => {
  it('returns no matches with an empty query', () => {
    const data = [
      entry('2026-05-01T00:00:00Z', 'first log line'),
      entry('2026-05-01T00:00:01Z', 'second log line'),
    ];
    const { result } = renderHook(() => useLogSearch(data));

    expect(result.current.searchQuery).toBe('');
    expect(result.current.totalMatches).toBe(0);
    expect(result.current.matches).toEqual([]);
    expect(result.current.tableData).toBe(data);
  });

  it('finds matches across multiple rows', () => {
    const data = [
      entry('2026-05-01T00:00:00Z', 'foo bar baz'),
      entry('2026-05-01T00:00:01Z', 'no hit here'),
      entry('2026-05-01T00:00:02Z', 'another foo'),
    ];
    const { result } = renderHook(() => useLogSearch(data));

    act(() => result.current.setQuery('foo'));

    expect(result.current.totalMatches).toBe(2);
    expect(result.current.matches).toEqual([
      { rowIndex: 0, start: 0, end: 3 },
      { rowIndex: 2, start: 8, end: 11 },
    ]);
  });

  it('finds multiple matches in a single row', () => {
    const data = [entry('2026-05-01T00:00:00Z', 'foo and foo again')];
    const { result } = renderHook(() => useLogSearch(data));

    act(() => result.current.setQuery('foo'));

    expect(result.current.totalMatches).toBe(2);
    expect(result.current.matches).toEqual([
      { rowIndex: 0, start: 0, end: 3 },
      { rowIndex: 0, start: 8, end: 11 },
    ]);
  });

  it('is case-insensitive', () => {
    const data = [entry('2026-05-01T00:00:00Z', 'ERROR found in Module')];
    const { result } = renderHook(() => useLogSearch(data));

    act(() => result.current.setQuery('error'));

    expect(result.current.totalMatches).toBe(1);
    expect(result.current.matches[0]).toEqual({
      rowIndex: 0,
      start: 0,
      end: 5,
    });
  });

  describe('filter mode', () => {
    it('returns full data when filter mode is on but query is empty', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'first'),
        entry('2026-05-01T00:00:01Z', 'second'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.toggleFilter());

      expect(result.current.filterMode).toBe(true);
      expect(result.current.tableData).toBe(data);
    });

    it('returns full data when query is set but filter mode is off', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'foo'),
        entry('2026-05-01T00:00:01Z', 'bar'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));

      expect(result.current.filterMode).toBe(false);
      expect(result.current.tableData).toBe(data);
      expect(result.current.totalMatches).toBe(1);
    });

    it('filters tableData to matching rows when filter mode is on with a query', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'foo bar'),
        entry('2026-05-01T00:00:01Z', 'no hit'),
        entry('2026-05-01T00:00:02Z', 'another foo'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => {
        result.current.toggleFilter();
        result.current.setQuery('foo');
      });

      expect(result.current.tableData).toHaveLength(2);
      expect(result.current.tableData[0].log).toBe('foo bar');
      expect(result.current.tableData[1].log).toBe('another foo');
    });

    it('reports zero matches when filter excludes everything', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'first'),
        entry('2026-05-01T00:00:01Z', 'second'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => {
        result.current.toggleFilter();
        result.current.setQuery('xyz');
      });

      expect(result.current.tableData).toEqual([]);
      expect(result.current.totalMatches).toBe(0);
    });

    it('indexes matches against filtered rows, not original rows', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'foo bar'),
        entry('2026-05-01T00:00:01Z', 'no hit'),
        entry('2026-05-01T00:00:02Z', 'another foo'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => {
        result.current.toggleFilter();
        result.current.setQuery('foo');
      });

      expect(result.current.matches).toEqual([
        { rowIndex: 0, start: 0, end: 3 },
        { rowIndex: 1, start: 8, end: 11 },
      ]);
    });
  });

  describe('navigation', () => {
    const data = [
      entry('2026-05-01T00:00:00Z', 'foo one'),
      entry('2026-05-01T00:00:01Z', 'foo two'),
      entry('2026-05-01T00:00:02Z', 'foo three'),
    ];

    it('starts at the first match by default', () => {
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));

      expect(result.current.currentMatch).toBe(0);
    });

    it('advances to the next match via setCurrentMatchIndex', () => {
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));
      act(() => result.current.setCurrentMatchIndex(2));

      expect(result.current.currentMatch).toBe(2);
    });

    it('clamps currentMatch when it would exceed totalMatches', () => {
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));
      act(() => result.current.setCurrentMatchIndex(2));
      // shrink the match set by narrowing the query — only "foo three" matches "three"
      act(() => result.current.setQuery('three'));

      expect(result.current.totalMatches).toBe(1);
      expect(result.current.currentMatch).toBe(0);
    });

    it('resets currentMatchIndex to 0 when query changes', () => {
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));
      act(() => result.current.setCurrentMatchIndex(2));
      act(() => result.current.setQuery('foo two'));

      expect(result.current.currentMatch).toBe(0);
    });

    it('clear() resets query and current match', () => {
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));
      act(() => result.current.setCurrentMatchIndex(1));
      act(() => result.current.clear());

      expect(result.current.searchQuery).toBe('');
      expect(result.current.currentMatch).toBe(0);
      expect(result.current.totalMatches).toBe(0);
    });
  });

  describe('rangesByRow', () => {
    it('marks only the current match with isCurrent: true', () => {
      const data = [
        entry('2026-05-01T00:00:00Z', 'foo and foo again'),
        entry('2026-05-01T00:00:01Z', 'one more foo'),
      ];
      const { result } = renderHook(() => useLogSearch(data));

      act(() => result.current.setQuery('foo'));
      // currentMatch = 0 → first match in row 0 is current
      const initialRow0 = result.current.rangesByRow.get(0);
      expect(initialRow0).toEqual([
        { start: 0, end: 3, isCurrent: true },
        { start: 8, end: 11, isCurrent: false },
      ]);

      act(() => result.current.setCurrentMatchIndex(2));
      // currentMatch = 2 → match in row 1 is current
      expect(result.current.rangesByRow.get(0)).toEqual([
        { start: 0, end: 3, isCurrent: false },
        { start: 8, end: 11, isCurrent: false },
      ]);
      expect(result.current.rangesByRow.get(1)).toEqual([
        { start: 9, end: 12, isCurrent: true },
      ]);
    });

    it('is empty when there is no query', () => {
      const data = [entry('2026-05-01T00:00:00Z', 'foo')];
      const { result } = renderHook(() => useLogSearch(data));

      expect(result.current.rangesByRow.size).toBe(0);
    });
  });
});

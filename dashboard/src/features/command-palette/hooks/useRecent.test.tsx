import { vi } from 'vitest';
import { useRecent } from '@/features/command-palette/hooks/useRecent';
import { act, renderHook } from '@/tests/testUtils';

const makeEntry = (overrides: {
  nodeId: string;
  title?: string;
  orgSlug?: string;
  appSubdomain?: string;
  accessedAt?: number;
}) => ({
  nodeId: overrides.nodeId,
  title: overrides.title ?? overrides.nodeId,
  path: `/path/${overrides.nodeId}`,
  orgSlug: overrides.orgSlug,
  appSubdomain: overrides.appSubdomain,
  accessedAt: overrides.accessedAt,
});

describe('useRecent', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists recent entries and reloads them across remounts', () => {
    const { result, unmount } = renderHook(() => useRecent());

    act(() => {
      result.current.pushRecent(makeEntry({ nodeId: 'project-graphql' }));
    });

    expect(result.current.recent).toEqual([
      expect.objectContaining({
        nodeId: 'project-graphql',
        accessedAt: Date.parse('2026-06-26T12:00:00.000Z'),
      }),
    ]);

    unmount();

    const { result: remountedResult } = renderHook(() => useRecent());

    expect(remountedResult.current.recent).toEqual(result.current.recent);
  });

  it('dedupes by node id, org slug, and app subdomain', () => {
    const { result } = renderHook(() => useRecent());

    act(() => {
      result.current.pushRecent(
        makeEntry({
          nodeId: 'project-settings-general',
          title: 'General A',
          orgSlug: 'acme',
          appSubdomain: 'app-a',
          accessedAt: 1,
        }),
      );
      result.current.pushRecent(
        makeEntry({
          nodeId: 'project-settings-general',
          title: 'General B',
          orgSlug: 'acme',
          appSubdomain: 'app-b',
          accessedAt: 2,
        }),
      );
    });

    expect(result.current.recent.map((entry) => entry.appSubdomain)).toEqual([
      'app-b',
      'app-a',
    ]);

    act(() => {
      result.current.pushRecent(
        makeEntry({
          nodeId: 'project-settings-general',
          title: 'General A updated',
          orgSlug: 'acme',
          appSubdomain: 'app-a',
          accessedAt: 3,
        }),
      );
    });

    expect(result.current.recent).toEqual([
      expect.objectContaining({
        title: 'General A updated',
        appSubdomain: 'app-a',
        accessedAt: 3,
      }),
      expect.objectContaining({ title: 'General B', appSubdomain: 'app-b' }),
    ]);
  });

  it('keeps a five-entry MRU cap', () => {
    const { result } = renderHook(() => useRecent());

    act(() => {
      for (let index = 0; index < 6; index += 1) {
        result.current.pushRecent(
          makeEntry({ nodeId: `node-${index}`, accessedAt: index }),
        );
      }
    });

    expect(result.current.recent.map((entry) => entry.nodeId)).toEqual([
      'node-5',
      'node-4',
      'node-3',
      'node-2',
      'node-1',
    ]);
  });

  it('clears persisted recents', () => {
    const { result } = renderHook(() => useRecent());

    act(() => {
      result.current.pushRecent(makeEntry({ nodeId: 'docs' }));
      result.current.clearRecent();
    });

    expect(result.current.recent).toEqual([]);
    expect(window.localStorage.getItem('command-palette-recent')).toBe('[]');
  });
});

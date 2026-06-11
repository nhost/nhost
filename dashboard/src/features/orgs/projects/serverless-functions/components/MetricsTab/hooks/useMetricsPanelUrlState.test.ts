import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import useMetricsPanelUrlState from './useMetricsPanelUrlState';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const PATHNAME =
  '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]';

const REPLACE_OPTS = { shallow: true, scroll: false };

function mockRouter(query: Record<string, string | string[] | undefined>) {
  const replace = vi.fn();
  mocks.useRouter.mockReturnValue({ pathname: PATHNAME, query, replace });
  return replace;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMetricsPanelUrlState', () => {
  it('returns no open panel and no hidden keys for an empty query', () => {
    mockRouter({ orgSlug: 'org-1' });

    const { result } = renderHook(() => useMetricsPanelUrlState());

    expect(result.current.openPanel).toBeNull();
    expect(result.current.hiddenKeys).toEqual([]);
  });

  it('derives the open panel and parses hidden keys from the query', () => {
    mockRouter({ metricPanel: 'invocations', metricHidden: 'get, post ,' });

    const { result } = renderHook(() => useMetricsPanelUrlState());

    expect(result.current.openPanel).toBe('invocations');
    expect(result.current.hiddenKeys).toEqual(['get', 'post']);
  });

  it('treats an unknown panel slug as no open panel and ignores its hidden keys', () => {
    mockRouter({ metricPanel: 'not-a-panel', metricHidden: 'get' });

    const { result } = renderHook(() => useMetricsPanelUrlState());

    expect(result.current.openPanel).toBeNull();
    expect(result.current.hiddenKeys).toEqual([]);
  });

  it('open() sets the panel, preserves unrelated params, and clears hidden keys', () => {
    const replace = mockRouter({
      orgSlug: 'org-1',
      appSubdomain: 'app-1',
      functionSlug: 'hello',
      tab: 'metrics',
      metricRange: '6h',
      metricHidden: 'get',
    });

    const { result } = renderHook(() => useMetricsPanelUrlState());
    result.current.open('error-rate');

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: {
          orgSlug: 'org-1',
          appSubdomain: 'app-1',
          functionSlug: 'hello',
          tab: 'metrics',
          metricRange: '6h',
          metricPanel: 'error-rate',
        },
      },
      undefined,
      REPLACE_OPTS,
    );
  });

  it('close() removes the panel param and preserves the rest', () => {
    const replace = mockRouter({
      orgSlug: 'org-1',
      tab: 'metrics',
      metricFrom: '2026-06-01T00:00:00.000Z',
      metricTo: '2026-06-02T00:00:00.000Z',
      metricPanel: 'invocations',
      metricHidden: 'get',
    });

    const { result } = renderHook(() => useMetricsPanelUrlState());
    result.current.close();

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: {
          orgSlug: 'org-1',
          tab: 'metrics',
          metricFrom: '2026-06-01T00:00:00.000Z',
          metricTo: '2026-06-02T00:00:00.000Z',
        },
      },
      undefined,
      REPLACE_OPTS,
    );
  });

  it('setHiddenKeys() writes the hidden keys and keeps the open panel', () => {
    const replace = mockRouter({
      orgSlug: 'org-1',
      metricPanel: 'invocations',
      metricHidden: 'old',
    });

    const { result } = renderHook(() => useMetricsPanelUrlState());
    result.current.setHiddenKeys(['get', 'post']);

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: {
          orgSlug: 'org-1',
          metricPanel: 'invocations',
          metricHidden: 'get,post',
        },
      },
      undefined,
      REPLACE_OPTS,
    );
  });

  it('setHiddenKeys([]) clears the hidden-keys param', () => {
    const replace = mockRouter({
      orgSlug: 'org-1',
      metricPanel: 'invocations',
      metricHidden: 'get',
    });

    const { result } = renderHook(() => useMetricsPanelUrlState());
    result.current.setHiddenKeys([]);

    expect(replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: { orgSlug: 'org-1', metricPanel: 'invocations' },
      },
      undefined,
      REPLACE_OPTS,
    );
  });

  it('setHiddenKeys() is a no-op when no panel is open', () => {
    const replace = mockRouter({ orgSlug: 'org-1' });

    const { result } = renderHook(() => useMetricsPanelUrlState());
    result.current.setHiddenKeys(['get']);

    expect(replace).not.toHaveBeenCalled();
  });
});

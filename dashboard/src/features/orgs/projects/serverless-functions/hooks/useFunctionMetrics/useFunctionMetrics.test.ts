/** biome-ignore-all lint/suspicious/noExplicitAny: test file */
import { vi } from 'vitest';
import type { MetricsTimeRange } from '@/features/orgs/projects/common/metrics/utils/timeRange';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetFunctionsMetricsDashboardQuery } from '@/generated/graphql';
import { act, renderHook } from '@/tests/testUtils';
import useFunctionMetrics from './useFunctionMetrics';

// Mock the generated query hook so we can assert the variables/skip the hook
// computes and drive its result deterministically, exercising the hook's own
// logic (render-phase re-anchor, width gating, keep-previous-data, refetch
// branches) without hitting Apollo/MSW.
vi.mock('@/generated/graphql', async () => {
  const actual = await vi.importActual<any>('@/generated/graphql');
  return {
    ...actual,
    useGetFunctionsMetricsDashboardQuery: vi.fn(),
  };
});

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

const mockQuery = vi.mocked(useGetFunctionsMetricsDashboardQuery);
const mockUseProject = vi.mocked(useProject);

const apolloRefetch = vi.fn();

const queryResult = (overrides: Record<string, unknown> = {}) =>
  ({
    data: undefined,
    previousData: undefined,
    loading: false,
    error: undefined,
    refetch: apolloRefetch,
    ...overrides,
  }) as any;

// Minimal valid response shape so the real transformFunctionMetrics runs.
const EMPTY_RESPONSE = {
  totalInvocations: [],
  totalBytesSent: [],
  totalDuration: [],
  totalErrors: [],
  totalRequestsByMethod: [],
  invocations: [],
  responseStatus: [],
  averageResponseSize: [],
  averageResponseTime: [],
  errorRate: [],
  durationP75: [],
  durationP95: [],
  durationMax: [],
};

const T0 = new Date('2026-06-05T12:00:00.000Z');

const presetRange: MetricsTimeRange = { kind: 'preset', preset: '6h' };
const absoluteRange: MetricsTimeRange = {
  kind: 'absolute',
  from: '2026-06-01T00:00:00.000Z',
  to: '2026-06-02T00:00:00.000Z',
};

const lastOptions = () => mockQuery.mock.calls.at(-1)?.[0] as any;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  mockUseProject.mockReturnValue({
    project: { id: 'project-1' },
    loading: false,
  } as any);
  mockQuery.mockReturnValue(queryResult());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFunctionMetrics', () => {
  it('escapes regex metacharacters in the route before querying', () => {
    renderHook(() =>
      useFunctionMetrics({
        route: '/foo.bar+baz',
        range: presetRange,
        chartWidth: 800,
      }),
    );

    expect(lastOptions().variables.route).toBe('/foo\\.bar\\+baz');
  });

  it('keeps query variables stable across re-renders with an unchanged range', () => {
    const { rerender } = renderHook((props) => useFunctionMetrics(props), {
      initialProps: { route: '/hello', range: presetRange, chartWidth: 800 },
    });

    const first = lastOptions().variables;
    // Time advances, but a plain re-render with the same range must NOT
    // re-anchor `now` — otherwise variables churn and Apollo refetches.
    vi.setSystemTime(new Date('2026-06-05T12:30:00.000Z'));
    rerender({ route: '/hello', range: presetRange, chartWidth: 800 });
    const second = lastOptions().variables;

    expect(second.from).toBe(first.from);
    expect(second.to).toBe(first.to);
    expect(second.intervalMs).toBe(first.intervalMs);
    expect(second.maxDataPoints).toBe(first.maxDataPoints);
  });

  it('re-anchors "now" when the range changes', () => {
    const { rerender } = renderHook((props) => useFunctionMetrics(props), {
      initialProps: { route: '/hello', range: presetRange, chartWidth: 800 },
    });

    expect(lastOptions().variables.to).toBe(T0.toISOString());

    vi.setSystemTime(new Date('2026-06-05T13:00:00.000Z'));
    rerender({
      route: '/hello',
      range: { kind: 'preset', preset: '1h' },
      chartWidth: 800,
    });

    expect(lastOptions().variables.to).toBe('2026-06-05T13:00:00.000Z');
  });

  it('skips the query until a positive chart width is committed', () => {
    const { result, rerender } = renderHook(
      (props) => useFunctionMetrics(props),
      {
        initialProps: { route: '/hello', range: presetRange, chartWidth: 0 },
      },
    );

    expect(lastOptions().skip).toBe(true);
    expect(result.current.loading).toBe(true);

    rerender({ route: '/hello', range: presetRange, chartWidth: 640 });

    expect(lastOptions().skip).toBe(false);
    expect(lastOptions().variables.maxDataPoints).toBe(640);
  });

  it('skips the query and sends an empty appID when no project is loaded', () => {
    mockUseProject.mockReturnValue({
      project: undefined,
      loading: false,
    } as any);

    renderHook(() =>
      useFunctionMetrics({
        route: '/hello',
        range: presetRange,
        chartWidth: 800,
      }),
    );

    expect(lastOptions().skip).toBe(true);
    expect(lastOptions().variables.appID).toBe('');
  });

  it('falls back to previousData while the next response is in flight', () => {
    mockQuery.mockReturnValue(
      queryResult({
        data: undefined,
        previousData: EMPTY_RESPONSE,
        loading: true,
      }),
    );

    const { result } = renderHook(() =>
      useFunctionMetrics({
        route: '/hello',
        range: presetRange,
        chartWidth: 800,
      }),
    );

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.summary.totalInvocations).toBe(0);
  });

  it('returns undefined data when neither current nor previous data exists', () => {
    const { result } = renderHook(() =>
      useFunctionMetrics({
        route: '/hello',
        range: presetRange,
        chartWidth: 800,
      }),
    );

    expect(result.current.data).toBeUndefined();
  });

  it('exposes the resolved [from, to] window as the x domain in ms', () => {
    const { result } = renderHook(() =>
      useFunctionMetrics({
        route: '/hello',
        range: absoluteRange,
        chartWidth: 800,
      }),
    );

    expect(result.current.xDomain).toEqual([
      new Date(absoluteRange.from).getTime(),
      new Date(absoluteRange.to).getTime(),
    ]);
  });

  describe('refetch', () => {
    it('re-anchors now on a preset range without calling Apollo refetch', () => {
      const { result } = renderHook(() =>
        useFunctionMetrics({
          route: '/hello',
          range: presetRange,
          chartWidth: 800,
        }),
      );

      vi.setSystemTime(new Date('2026-06-05T14:00:00.000Z'));
      act(() => result.current.refetch());

      expect(apolloRefetch).not.toHaveBeenCalled();
      expect(lastOptions().variables.to).toBe('2026-06-05T14:00:00.000Z');
    });

    it('recommits the width on an absolute range with a changed width', () => {
      const { result, rerender } = renderHook(
        (props) => useFunctionMetrics(props),
        {
          initialProps: {
            route: '/hello',
            range: absoluteRange,
            chartWidth: 800,
          },
        },
      );

      expect(lastOptions().variables.maxDataPoints).toBe(800);

      // Width grows, but committedWidth stays put until refetch recommits it.
      rerender({ route: '/hello', range: absoluteRange, chartWidth: 1000 });
      expect(lastOptions().variables.maxDataPoints).toBe(800);

      act(() => result.current.refetch());

      expect(apolloRefetch).not.toHaveBeenCalled();
      expect(lastOptions().variables.maxDataPoints).toBe(1000);
    });

    it('calls Apollo refetch on an absolute range with an unchanged width', () => {
      const { result } = renderHook(() =>
        useFunctionMetrics({
          route: '/hello',
          range: absoluteRange,
          chartWidth: 800,
        }),
      );

      act(() => result.current.refetch());

      expect(apolloRefetch).toHaveBeenCalledTimes(1);
    });
  });
});

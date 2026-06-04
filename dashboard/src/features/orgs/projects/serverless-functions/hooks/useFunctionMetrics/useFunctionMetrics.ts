import { useCallback, useMemo, useState } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type MetricsTimeRange,
  resolveTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';
import {
  computeQueryStep,
  DEFAULT_MIN_INTERVAL,
  resolveMaxDataPoints,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/stepResolution';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';
import { transformFunctionMetrics } from '@/features/orgs/projects/serverless-functions/utils/transformFunctionMetrics';
import { useGetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';

// Escapes regex metacharacters in a function route so it matches literally.
const ROUTE_REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

interface UseFunctionMetricsOptions {
  route: string;
  range: MetricsTimeRange;
  // Measured panel width in pixels. Drives maxDataPoints (and therefore the
  // step). 0 / undefined falls back to DEFAULT_MAX_DATA_POINTS until the
  // ResizeObserver lands.
  chartWidth: number;
}

interface UseFunctionMetricsResult {
  data: FunctionMetricsResponse | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
  xDomain: [number, number];
}

export default function useFunctionMetrics({
  route,
  range,
  chartWidth,
}: UseFunctionMetricsOptions): UseFunctionMetricsResult {
  const { project, loading: loadingProject } = useProject();
  const [now, setNow] = useState(() => new Date());
  const [prevRange, setPrevRange] = useState(range);

  const [committedWidth, setCommittedWidth] = useState(chartWidth);

  if (committedWidth <= 0 && chartWidth > 0) {
    setCommittedWidth(chartWidth);
  }

  // Re-anchor "now" when range changes, so a freshly-picked preset is evaluated
  // at the current time, not page-load time. Derive-during-render (vs useEffect)
  // avoids a double-fetch — React retries the render with the new state.
  if (prevRange !== range) {
    setPrevRange(range);
    setNow(new Date());
    setCommittedWidth(chartWidth);
  }

  const { from, to } = useMemo(
    () => resolveTimeRange(range, now),
    [range, now],
  );

  const { intervalMs, maxDataPoints } = useMemo(
    () => computeQueryStep(from, to, resolveMaxDataPoints(committedWidth)),
    [from, to, committedWidth],
  );

  // Function paths like `/api/users.ts` contain regex metacharacters, so escape them for literal match.
  const escapedRoute = route.replace(ROUTE_REGEX_METACHARACTERS, '\\$&');

  const {
    data: queryData,
    previousData,
    loading: loadingQuery,
    error,
    refetch: apolloRefetch,
  } = useGetFunctionsMetricsDashboardQuery({
    variables: {
      appID: project?.id ?? '',
      route: escapedRoute,
      from: from.toISOString(),
      to: to.toISOString(),
      intervalMs,
      maxDataPoints,
      minInterval: DEFAULT_MIN_INTERVAL,
    },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !project?.id || committedWidth <= 0,
  });

  // Apollo's equivalent of TanStack's `placeholderData: keepPreviousData`: when
  // variables change (zoom, time-range pick, refresh) `queryData` flips to
  // undefined until the next round-trip lands. Falling back to `previousData`
  // keeps the charts rendered with stale data instead of flashing the skeleton.
  const sourceData = queryData ?? previousData;

  const data = useMemo(
    () => (sourceData ? transformFunctionMetrics(sourceData, to) : undefined),
    [sourceData, to],
  );

  const refetch = useCallback(() => {
    if (range.kind === 'preset') {
      setCommittedWidth(chartWidth);
      setNow(new Date());
    } else if (chartWidth !== committedWidth) {
      setCommittedWidth(chartWidth);
    } else {
      apolloRefetch();
    }
  }, [range.kind, chartWidth, committedWidth, apolloRefetch]);

  const xDomain = useMemo<[number, number]>(
    () => [from.getTime(), to.getTime()],
    [from, to],
  );

  return {
    data,
    loading:
      loadingProject || loadingQuery || (!!project?.id && committedWidth <= 0),
    error,
    refetch,
    xDomain,
  };
}

import { useCallback, useMemo, useState } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type MetricsTimeRange,
  resolveTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';
import { computeQueryStep } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/stepResolution';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';
import { transformFunctionMetrics } from '@/features/orgs/projects/serverless-functions/utils/transformFunctionMetrics';
import { useGetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';

interface UseFunctionMetricsOptions {
  route: string;
  range: MetricsTimeRange;
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
}: UseFunctionMetricsOptions): UseFunctionMetricsResult {
  const { project, loading: loadingProject } = useProject();
  const [refetchKey, setRefetchKey] = useState(0);

  // refetchKey forces a fresh "now" when the user clicks refresh; range/now changes
  // propagate to from/to and Apollo re-fetches automatically on variable change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refetchKey is a re-run trigger.
  const { from, to } = useMemo(
    () => resolveTimeRange(range),
    [range, refetchKey],
  );

  const { intervalMs, maxDataPoints } = useMemo(
    () => computeQueryStep(from, to),
    [from, to],
  );

  // Function paths like `/api/users.ts` contain regex metacharacters, so escape them for literal match.
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const {
    data: queryData,
    previousData,
    loading: loadingQuery,
    error,
  } = useGetFunctionsMetricsDashboardQuery({
    variables: {
      appID: project?.id ?? '',
      route: escapedRoute,
      from: from.toISOString(),
      to: to.toISOString(),
      intervalMs,
      maxDataPoints,
    },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !project?.id,
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
    setRefetchKey((k) => k + 1);
  }, []);

  const xDomain = useMemo<[number, number]>(
    () => [from.getTime(), to.getTime()],
    [from, to],
  );

  return {
    data,
    loading: loadingProject || loadingQuery,
    error,
    refetch,
    xDomain,
  };
}

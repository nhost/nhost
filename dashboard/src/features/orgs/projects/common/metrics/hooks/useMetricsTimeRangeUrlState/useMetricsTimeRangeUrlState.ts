import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import {
  DEFAULT_METRICS_TIME_RANGE,
  isMetricsRangePreset,
  type MetricsTimeRange,
} from '@/features/orgs/projects/common/metrics/utils/timeRange';

// The function details page is the one page with metrics time ranges.
const functionRoute =
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$';

interface MetricsTimeRangeUrlState {
  range: MetricsTimeRange;
  setRange: (next: MetricsTimeRange) => void;
}

function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export default function useMetricsTimeRangeUrlState(): MetricsTimeRangeUrlState {
  const navigate = useNavigate({ from: functionRoute });
  // Read each relevant key individually so unrelated URL changes (e.g. opening a
  // panel via the eye icon) don't churn `range`'s identity and trigger refetches.
  const rangeParam = useSearch({
    from: functionRoute,
    select: (search) => search.metricRange,
  });
  const fromParam = useSearch({
    from: functionRoute,
    select: (search) => search.metricFrom,
  });
  const toParam = useSearch({
    from: functionRoute,
    select: (search) => search.metricTo,
  });

  const range = useMemo<MetricsTimeRange>(() => {
    if (rangeParam && isMetricsRangePreset(rangeParam)) {
      return { kind: 'preset', preset: rangeParam };
    }
    if (fromParam && toParam && isValidIso(fromParam) && isValidIso(toParam)) {
      return { kind: 'absolute', from: fromParam, to: toParam };
    }
    return DEFAULT_METRICS_TIME_RANGE;
  }, [rangeParam, fromParam, toParam]);

  const setRange = useCallback(
    (next: MetricsTimeRange) => {
      navigate({
        search: (prev) => ({
          ...prev,
          metricRange: next.kind === 'preset' ? next.preset : undefined,
          metricFrom: next.kind === 'absolute' ? next.from : undefined,
          metricTo: next.kind === 'absolute' ? next.to : undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    },
    [navigate],
  );

  return { range, setRange };
}

import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import {
  DEFAULT_METRICS_TIME_RANGE,
  isMetricsRangePreset,
  type MetricsTimeRange,
} from '@/features/orgs/projects/common/metrics/utils/timeRange';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

const RANGE_KEY = 'metricRange';
const FROM_KEY = 'metricFrom';
const TO_KEY = 'metricTo';

interface MetricsTimeRangeUrlState {
  range: MetricsTimeRange;
  setRange: (next: MetricsTimeRange) => void;
}

function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export default function useMetricsTimeRangeUrlState(): MetricsTimeRangeUrlState {
  const router = useRouter();
  // Read each relevant key individually so unrelated URL changes (e.g. opening a
  // panel via the eye icon) don't churn `range`'s identity and trigger refetches.
  const rangeParam = getSingleQueryParam(router.query[RANGE_KEY]);
  const fromParam = getSingleQueryParam(router.query[FROM_KEY]);
  const toParam = getSingleQueryParam(router.query[TO_KEY]);

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
      const query = { ...router.query };
      delete query[RANGE_KEY];
      delete query[FROM_KEY];
      delete query[TO_KEY];
      if (next.kind === 'preset') {
        query[RANGE_KEY] = next.preset;
      } else {
        query[FROM_KEY] = next.from;
        query[TO_KEY] = next.to;
      }
      router.replace({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  return { range, setRange };
}

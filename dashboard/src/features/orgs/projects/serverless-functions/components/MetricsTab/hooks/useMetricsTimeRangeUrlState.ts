import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import {
  DEFAULT_METRICS_TIME_RANGE,
  isMetricsRangePreset,
  type MetricsTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';

const RANGE_KEY = 'metricRange';
const FROM_KEY = 'metricFrom';
const TO_KEY = 'metricTo';

export interface MetricsTimeRangeUrlState {
  range: MetricsTimeRange;
  setRange: (next: MetricsTimeRange) => void;
}

function readSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isValidIso(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export default function useMetricsTimeRangeUrlState(): MetricsTimeRangeUrlState {
  const router = useRouter();

  const range = useMemo<MetricsTimeRange>(() => {
    const preset = readSingle(router.query[RANGE_KEY]);
    if (preset && isMetricsRangePreset(preset)) {
      return { kind: 'preset', preset };
    }
    const from = readSingle(router.query[FROM_KEY]);
    const to = readSingle(router.query[TO_KEY]);
    if (from && to && isValidIso(from) && isValidIso(to)) {
      return { kind: 'absolute', from, to };
    }
    return DEFAULT_METRICS_TIME_RANGE;
  }, [router.query]);

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

import { useCallback, useEffect, useState } from 'react';
import {
  type MetricsTimeRange,
  resolveTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';
import type {
  ErrorsTableRow,
  FunctionMetricsResponse,
  MetricSeries,
  RequestsTableRow,
} from '@/features/orgs/projects/serverless-functions/types';

interface UseFunctionMetricsOptions {
  route: string;
  range: MetricsTimeRange;
}

interface UseFunctionMetricsResult {
  data: FunctionMetricsResponse | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

const TARGET_POINTS = 60;
const MIN_STEP_MS = 1_000;

export default function useFunctionMetrics({
  route,
  range,
}: UseFunctionMetricsOptions): UseFunctionMetricsResult {
  const [refetchKey, setRefetchKey] = useState(0);
  const [state, setState] = useState<{
    data?: FunctionMetricsResponse;
    loading: boolean;
  }>({ loading: true });

  const refetch = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetchKey is a re-run trigger, not a value read inside the effect
  useEffect(() => {
    setState({ loading: true });
    const handle = setTimeout(() => {
      const { from, to } = resolveTimeRange(range);
      setState({ data: buildMockMetrics(route, from, to), loading: false });
    }, 200);
    return () => clearTimeout(handle);
  }, [route, range, refetchKey]);

  return {
    data: state.data,
    loading: state.loading,
    error: undefined,
    refetch,
  };
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), Number.EPSILON);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface RangeBuckets {
  points: number;
  stepMs: number;
  startMs: number;
  timestamps: string[];
}

function bucketsForRange(from: Date, to: Date): RangeBuckets {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const durationMs = Math.max(MIN_STEP_MS * TARGET_POINTS, toMs - fromMs);
  const stepMs = Math.max(MIN_STEP_MS, Math.floor(durationMs / TARGET_POINTS));
  const points = Math.max(1, Math.floor(durationMs / stepMs));
  const startMs = toMs - (points - 1) * stepMs;
  const timestamps: string[] = [];
  for (let i = 0; i < points; i += 1) {
    timestamps.push(Math.floor((startMs + i * stepMs) / 1000).toString());
  }
  return { points, stepMs, startMs, timestamps };
}

function buildMockMetrics(
  route: string,
  from: Date,
  to: Date,
): FunctionMetricsResponse {
  const { points, timestamps } = bucketsForRange(from, to);
  const bucketHour = Math.floor(to.getTime() / 3_600_000);
  const rand = mulberry32(fnv1a(`${route}:${bucketHour}:${points}`));

  const methodShares: Array<[string, number, number]> = [
    ['GET', 0.7, 12],
    ['POST', 0.2, 4],
    ['PUT', 0.07, 1.2],
    ['DELETE', 0.03, 0.6],
  ];
  const baselineTotal = 20 + rand() * 40;

  const invocationsByMethod: MetricSeries[] = methodShares.map(
    ([method, share, _jitter]) => {
      const datapoints: number[] = [];
      for (let i = 0; i < points; i += 1) {
        const rhythm = 0.85 + 0.25 * Math.sin((i / points) * Math.PI * 2);
        const noise = 1 + gaussian(rand) * 0.15;
        const spike = rand() < 0.02 ? 1 + rand() * 1.5 : 1;
        const v = Math.max(
          0,
          Math.round(baselineTotal * share * rhythm * noise * spike),
        );
        datapoints.push(v);
      }
      return { labels: { method }, timestamps, datapoints };
    },
  );

  const totalsPerPoint: number[] = [];
  for (let i = 0; i < points; i += 1) {
    let sum = 0;
    invocationsByMethod.forEach((s) => {
      sum += s.datapoints[i];
    });
    totalsPerPoint.push(sum);
  }

  const statusAllocations: Array<[string, number]> = [
    ['200', 0.95],
    ['404', 0.03],
    ['400', 0.01],
    ['500', 0.01],
  ];
  const responseStatus: MetricSeries[] = statusAllocations.map(
    ([status, base]) => {
      const datapoints: number[] = [];
      for (let i = 0; i < points; i += 1) {
        let share = base;
        if (status === '500' && rand() < 0.04) {
          share += 0.1 + rand() * 0.1;
        } else if (status === '404' && rand() < 0.05) {
          share += 0.05 + rand() * 0.05;
        }
        const v = Math.max(0, Math.round(totalsPerPoint[i] * share));
        datapoints.push(v);
      }
      return { labels: { status }, timestamps, datapoints };
    },
  );

  const averageResponseSize: MetricSeries[] = methodShares.map(
    ([method, _share, _jitter]) => {
      const base = 1500 + rand() * 2000;
      const trend = 50 + rand() * 40;
      const datapoints: number[] = [];
      for (let i = 0; i < points; i += 1) {
        const drift = (i / points) * trend;
        const noise = gaussian(rand) * 200;
        const v = Math.max(64, Math.round(base + drift + noise));
        datapoints.push(v);
      }
      return { labels: { method }, timestamps, datapoints };
    },
  );

  const methodMultipliers: Record<string, number> = {
    GET: 1,
    POST: 2.1,
    PUT: 1.8,
    DELETE: 1.3,
  };
  const avg: MetricSeries[] = methodShares.map(([method]) => {
    const mult = methodMultipliers[method] ?? 1;
    const datapoints: number[] = [];
    for (let i = 0; i < points; i += 1) {
      const base = 0.02 * mult;
      const noise = Math.abs(gaussian(rand) * 0.005);
      datapoints.push(Math.max(0.001, base + noise));
    }
    return { labels: { method }, timestamps, datapoints };
  });

  const p75: MetricSeries[] = avg.map((s) => ({
    labels: s.labels,
    timestamps,
    datapoints: s.datapoints.map((v) => v * (1.55 + rand() * 0.2)),
  }));

  const p95: MetricSeries[] = p75.map((s) => ({
    labels: s.labels,
    timestamps,
    datapoints: s.datapoints.map((v) => v * (1.35 + rand() * 0.2)),
  }));

  const max: MetricSeries[] = p95.map((s) => ({
    labels: s.labels,
    timestamps,
    datapoints: s.datapoints.map((v) => v * (1.45 + rand() * 0.25)),
  }));

  const totalRequestsByMethod = methodShares.map(([method], idx) => {
    const sum = invocationsByMethod[idx].datapoints.reduce(
      (acc, v) => acc + v,
      0,
    );
    return { method, value: sum };
  });
  const toIso = to.toISOString();
  const totalRequests: RequestsTableRow[] = totalRequestsByMethod
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((r) => ({ timestamp: toIso, method: r.method, value: r.value }));

  const errorsByMethod: Record<string, { total: number; errors: number }> = {};
  methodShares.forEach(([method], idx) => {
    errorsByMethod[method] = {
      total: invocationsByMethod[idx].datapoints.reduce((a, v) => a + v, 0),
      errors: 0,
    };
  });

  const errorRate: MetricSeries[] = methodShares.map(([method], idx) => {
    const datapoints: number[] = [];
    for (let i = 0; i < points; i += 1) {
      const calls = invocationsByMethod[idx].datapoints[i];
      if (calls === 0) {
        datapoints.push(0);
        continue;
      }
      let ratio = 0.01 + rand() * 0.02;
      if (rand() < 0.05) {
        ratio += 0.05 + rand() * 0.1;
      }
      datapoints.push(Math.min(1, ratio));
      errorsByMethod[method].errors += Math.round(calls * ratio);
    }
    return { labels: { method }, timestamps, datapoints };
  });

  const errorStatuses = ['400', '404', '500'];
  const totalErrorsRows: ErrorsTableRow[] = [];
  Object.entries(errorsByMethod).forEach(([method, { errors }]) => {
    if (errors <= 0) {
      return;
    }
    const weights = errorStatuses.map(() => rand() + 0.1);
    const weightSum = weights.reduce((a, v) => a + v, 0);
    errorStatuses.forEach((status, i) => {
      const value = Math.round((weights[i] / weightSum) * errors);
      if (value > 0) {
        totalErrorsRows.push({ timestamp: toIso, method, status, value });
      }
    });
  });
  totalErrorsRows.sort((a, b) => b.value - a.value);

  const totalInvocations = totalsPerPoint.reduce((a, v) => a + v, 0);

  let totalBytesSent = 0;
  invocationsByMethod.forEach((inv, idx) => {
    for (let i = 0; i < points; i += 1) {
      totalBytesSent +=
        inv.datapoints[i] * averageResponseSize[idx].datapoints[i];
    }
  });

  let totalDurationSeconds = 0;
  invocationsByMethod.forEach((inv, idx) => {
    for (let i = 0; i < points; i += 1) {
      totalDurationSeconds += inv.datapoints[i] * avg[idx].datapoints[i];
    }
  });

  return {
    summary: {
      totalInvocations,
      totalBytesSent: Math.round(totalBytesSent),
      totalDurationSeconds,
    },
    general: {
      invocationsByMethod,
      responseStatus,
      averageResponseSize,
      totalRequests,
    },
    responseTimes: { max, p95, p75, avg },
    errors: { errorRate, totalErrors: totalErrorsRows },
  };
}

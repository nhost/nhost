import type { ChartConfig } from '@/components/ui/v3/chart';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { resolveSeriesKeys } from '@/features/orgs/projects/common/metrics/utils/resolveSeriesKeys';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

// When two adjacent samples are farther apart than 1.5× the typical bucket
// step, insert a synthetic null row between them so Recharts (with
// connectNulls={false}) breaks the line instead of drawing a misleading slope
// across the gap.
const GAP_THRESHOLD_FACTOR = 1.5;

export interface ChartModel {
  // Unique, collision-suffixed key per series, index-aligned with the input.
  keys: string[];
  rows: Row[];
  config: ChartConfig;
}

// Everything MetricChart needs from a set of series. resolveSeriesKeys runs
// once, and both the rows and the color config are keyed from that single
// result, so the two can never drift apart.
export function buildChart(
  series: MetricSeries[],
  accessors: SeriesAccessors,
): ChartModel {
  const keys = resolveSeriesKeys(series, accessors.keyFor);
  return {
    keys,
    rows: mergeRows(series, keys),
    config: buildConfig(series, keys, accessors),
  };
}

function mergeRows(series: MetricSeries[], keys: string[]): Row[] {
  if (!series.length) {
    return [];
  }

  const maps = series.map((s) => {
    const map = new Map<number, number>();
    const len = Math.min(s.timestamps.length, s.datapoints.length);
    for (let i = 0; i < len; i += 1) {
      const ts = new Date(s.timestamps[i]).getTime();
      const value = s.datapoints[i];
      if (!Number.isNaN(ts) && typeof value === 'number') {
        map.set(ts, value);
      }
    }
    return map;
  });

  const timestampSet = new Set<number>();
  maps.forEach((m) => {
    m.forEach((_v, t) => {
      timestampSet.add(t);
    });
  });
  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);

  const rows: Row[] = timestamps.map((t) => {
    const row: Row = { timestamp: t };
    keys.forEach((key, i) => {
      const v = maps[i].get(t);
      row[key] = v === undefined ? null : v;
    });
    return row;
  });

  return insertGapBreaks(rows, keys);
}

function buildConfig(
  series: MetricSeries[],
  keys: string[],
  { labelFor, colorFor }: SeriesAccessors,
): ChartConfig {
  const config: ChartConfig = {};
  series.forEach((s, i) => {
    const key = keys[i];
    config[key] = {
      label: labelFor(key, s.labels),
      color: colorFor(key, s.labels, i),
    };
  });
  return config;
}

function insertGapBreaks(rows: Row[], keys: string[]): Row[] {
  if (rows.length < 3) {
    return rows;
  }
  const deltas: number[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    deltas.push(rows[i].timestamp - rows[i - 1].timestamp);
  }
  const median = computeMedian(deltas);
  if (!Number.isFinite(median) || median <= 0) {
    return rows;
  }
  const threshold = median * GAP_THRESHOLD_FACTOR;
  const out: Row[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i];
    out.push(current);
    const next = rows[i + 1];
    if (!next) {
      continue;
    }
    if (next.timestamp - current.timestamp > threshold) {
      const filler: Row = {
        timestamp: (current.timestamp + next.timestamp) / 2,
      };
      keys.forEach((k) => {
        filler[k] = null;
      });
      out.push(filler);
    }
  }
  return out;
}

function computeMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

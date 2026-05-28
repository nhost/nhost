import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

interface MergedSeries {
  keys: string[];
  rows: Array<Record<string, number | null> & { timestamp: number }>;
}

type Row = Record<string, number | null> & { timestamp: number };

// When two adjacent samples are farther apart than 1.5× the typical bucket
// step, insert a synthetic null row between them so Recharts (with
// connectNulls={false}) breaks the line instead of drawing a misleading slope
// across the gap.
const GAP_THRESHOLD_FACTOR = 1.5;

export function mergeSeries(
  series: MetricSeries[],
  keyFor: (labels: Record<string, string>) => string,
): MergedSeries {
  if (!series.length) {
    return { keys: [], rows: [] };
  }

  const keys: string[] = [];
  const seen = new Set<string>();
  const maps: Array<Map<number, number>> = [];

  series.forEach((s) => {
    let key = keyFor(s.labels);
    if (seen.has(key)) {
      let i = 1;
      while (seen.has(`${key}_${i}`)) {
        i += 1;
      }
      key = `${key}_${i}`;
    }
    seen.add(key);
    keys.push(key);

    const map = new Map<number, number>();
    const len = Math.min(s.timestamps.length, s.datapoints.length);
    for (let i = 0; i < len; i += 1) {
      const ts = new Date(s.timestamps[i]).getTime();
      const value = s.datapoints[i];
      if (!Number.isNaN(ts) && typeof value === 'number') {
        map.set(ts, value);
      }
    }
    maps.push(map);
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

  return { keys, rows: insertGapBreaks(rows, keys) };
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

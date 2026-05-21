import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

export interface MergedSeries {
  keys: string[];
  rows: Array<Record<string, number | null> & { timestamp: number }>;
}

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
      // returns ISO 8601 timestamps via the `Timestamp` scalar.
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

  const rows = timestamps.map((t) => {
    const row: Record<string, number | null> & { timestamp: number } = {
      timestamp: t,
    };
    keys.forEach((key, i) => {
      const v = maps[i].get(t);
      row[key] = v === undefined ? null : v;
    });
    return row;
  });

  return { keys, rows };
}

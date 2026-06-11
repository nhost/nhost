import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { buildChart } from '@/features/orgs/projects/common/metrics/utils/buildChart';

const accessors: SeriesAccessors = {
  keyFor: (labels) => labels.method,
  labelFor: (_key, labels) => labels.method,
  colorFor: (key) => `color-${key}`,
};

describe('buildChart', () => {
  it('returns empty structures for empty input', () => {
    expect(buildChart([], accessors)).toEqual({
      keys: [],
      rows: [],
      config: {},
    });
  });

  it('keys the rows and the config from the same resolved keys, collisions included', () => {
    const ts = '2024-01-01T00:00:00Z';
    const input: MetricSeries[] = [
      { labels: { method: 'GET' }, timestamps: [ts], datapoints: [1] },
      { labels: { method: 'GET' }, timestamps: [ts], datapoints: [2] },
    ];

    const { keys, rows, config } = buildChart(input, accessors);

    // The second 'GET' is suffixed, and that same suffixed key must appear in
    // all three outputs — the whole point of resolving keys once.
    expect(keys).toEqual(['GET', 'GET_1']);
    expect(Object.keys(config)).toEqual(['GET', 'GET_1']);
    expect(rows).toEqual([
      { timestamp: new Date(ts).getTime(), GET: 1, GET_1: 2 },
    ]);
  });

  it('merges series onto a shared timeline, filling absent samples with null', () => {
    const t0 = '2024-01-01T00:00:00Z';
    const t1 = '2024-01-01T00:01:00Z';
    const input: MetricSeries[] = [
      { labels: { method: 'GET' }, timestamps: [t0], datapoints: [1] },
      { labels: { method: 'POST' }, timestamps: [t1], datapoints: [5] },
    ];

    expect(buildChart(input, accessors).rows).toEqual([
      { timestamp: new Date(t0).getTime(), GET: 1, POST: null },
      { timestamp: new Date(t1).getTime(), GET: null, POST: 5 },
    ]);
  });

  it('inserts a synthetic null row to break the line across a large gap', () => {
    const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
    const input: MetricSeries[] = [
      {
        labels: { method: 'GET' },
        // Steady 60s step, then a 480s jump — well past 1.5× the median.
        timestamps: [iso(0), iso(60), iso(120), iso(600)],
        datapoints: [1, 2, 3, 4],
      },
    ];

    const { rows } = buildChart(input, accessors);

    // 4 real rows + 1 filler inserted midway through the gap.
    expect(rows).toHaveLength(5);
    expect(rows[3].timestamp).toBe(((120 + 600) / 2) * 1000);
    expect(rows[3].GET).toBeNull();
  });
});

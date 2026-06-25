import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import { resolveSeriesKeys } from '@/features/orgs/projects/common/metrics/utils/resolveSeriesKeys';

// resolveSeriesKeys only reads `labels`; timestamps/datapoints are irrelevant.
const series = (labels: Record<string, string>): MetricSeries => ({
  labels,
  timestamps: [],
  datapoints: [],
});

describe('resolveSeriesKeys', () => {
  it('returns an empty array for empty input', () => {
    expect(resolveSeriesKeys([], (labels) => labels.method)).toEqual([]);
  });

  it('returns distinct keys unchanged, one per series', () => {
    const input = [series({ method: 'GET' }), series({ method: 'POST' })];
    expect(resolveSeriesKeys(input, (labels) => labels.method)).toEqual([
      'GET',
      'POST',
    ]);
  });

  it('preserves input order and suffixes the later duplicate', () => {
    const input = [series({ m: 'b' }), series({ m: 'a' }), series({ m: 'b' })];
    // result[i] derives from series[i]; the second `b` is the one suffixed.
    expect(resolveSeriesKeys(input, (labels) => labels.m)).toEqual([
      'b',
      'a',
      'b_1',
    ]);
  });

  it('suffixes consecutive collisions incrementally', () => {
    const input = [series({ m: 'a' }), series({ m: 'a' }), series({ m: 'a' })];
    expect(resolveSeriesKeys(input, (labels) => labels.m)).toEqual([
      'a',
      'a_1',
      'a_2',
    ]);
  });

  it('skips a suffix already taken by a natural key', () => {
    // `a_1` is occupied before the second `a` needs a suffix, so the collision
    // must fall through to `a_2` rather than clobber the existing series.
    const input = [
      series({ m: 'a' }),
      series({ m: 'a_1' }),
      series({ m: 'a' }),
    ];
    expect(resolveSeriesKeys(input, (labels) => labels.m)).toEqual([
      'a',
      'a_1',
      'a_2',
    ]);
  });

  it('produces a unique key per series when every key collides', () => {
    const input = Array.from({ length: 4 }, () => series({ m: 'x' }));
    const keys = resolveSeriesKeys(input, (labels) => labels.m);
    expect(keys).toHaveLength(input.length);
    expect(new Set(keys).size).toBe(input.length);
    expect(keys).toEqual(['x', 'x_1', 'x_2', 'x_3']);
  });

  it('treats an empty-string key like any other', () => {
    const input = [series({ k: '' }), series({ k: '' })];
    expect(resolveSeriesKeys(input, (labels) => labels.k)).toEqual(['', '_1']);
  });
});

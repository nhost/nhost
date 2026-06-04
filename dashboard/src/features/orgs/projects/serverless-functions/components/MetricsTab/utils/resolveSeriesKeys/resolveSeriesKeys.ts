import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

// Resolve a unique chart key for each series, suffixing collisions (`key_1`,
// `key_2`, …) so two series that map to the same label stay distinct. The
// returned keys are index-aligned with `series`. buildChart resolves them once
// and keys both the rows and the color config from the result, so the two
// always agree.
export function resolveSeriesKeys(
  series: MetricSeries[],
  keyFor: (labels: Record<string, string>) => string,
): string[] {
  const seen = new Set<string>();
  return series.map((s) => {
    let key = keyFor(s.labels);
    if (seen.has(key)) {
      let n = 1;
      while (seen.has(`${key}_${n}`)) {
        n += 1;
      }
      key = `${key}_${n}`;
    }
    seen.add(key);
    return key;
  });
}

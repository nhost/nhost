import type { MetricPanelFilter } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';
import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

export function applyMetricFilter(
  series: MetricSeries[],
  filter: MetricPanelFilter | undefined,
): MetricSeries[] {
  if (!filter) {
    return series;
  }
  const activeDims = Object.entries(filter).filter(
    ([, values]) => Array.isArray(values) && values.length > 0,
  );
  if (activeDims.length === 0) {
    return series;
  }
  return series.filter((s) =>
    activeDims.every(([dim, values]) => {
      const labelValue = s.labels[dim];
      return labelValue != null && values.includes(labelValue);
    }),
  );
}

export function uniqueLabelValues(
  series: MetricSeries[],
  dim: string,
): string[] {
  const set = new Set<string>();
  for (const s of series) {
    const v = s.labels[dim];
    if (v != null && v !== '') {
      set.add(v);
    }
  }
  return Array.from(set).sort();
}

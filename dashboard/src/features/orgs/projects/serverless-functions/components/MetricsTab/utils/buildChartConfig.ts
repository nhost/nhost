import type { ChartConfig } from '@/components/ui/v3/chart';
import { CHART_COLOR_PALETTE } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';
import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

export interface BuildChartConfigOptions {
  keyFor: (labels: Record<string, string>) => string;
  labelFor?: (key: string, labels: Record<string, string>) => string;
  colorFor?: (
    key: string,
    labels: Record<string, string>,
    index: number,
  ) => string | undefined;
}

export function buildChartConfig(
  series: MetricSeries[],
  { keyFor, labelFor, colorFor }: BuildChartConfigOptions,
): ChartConfig {
  const config: ChartConfig = {};
  const seen = new Set<string>();

  series.forEach((s, i) => {
    let key = keyFor(s.labels);
    if (seen.has(key)) {
      let n = 1;
      while (seen.has(`${key}_${n}`)) {
        n += 1;
      }
      key = `${key}_${n}`;
    }
    seen.add(key);

    config[key] = {
      label: labelFor ? labelFor(key, s.labels) : humanize(s.labels),
      color:
        colorFor?.(key, s.labels, i) ??
        CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length],
    };
  });

  return config;
}

function humanize(labels: Record<string, string>): string {
  const values = Object.values(labels).filter(Boolean);
  return values.length ? values.join(' · ') : 'series';
}

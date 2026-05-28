const METRIC_PANEL_SLUGS = [
  'invocations',
  'response-status',
  'avg-response-size',
  'response-time-max',
  'response-time-p95',
  'response-time-p75',
  'response-time-avg',
  'error-rate',
] as const;

export type MetricPanelSlug = (typeof METRIC_PANEL_SLUGS)[number];

export function isMetricPanelSlug(value: unknown): value is MetricPanelSlug {
  return (
    typeof value === 'string' &&
    (METRIC_PANEL_SLUGS as readonly string[]).includes(value)
  );
}

export interface MetricPanelConfig {
  slug: MetricPanelSlug;
  title: string;
  description?: string;
  labelDimensions: string[];
  valueFormatterKind: 'integer' | 'bytes' | 'ms' | 'percent-unit';
}

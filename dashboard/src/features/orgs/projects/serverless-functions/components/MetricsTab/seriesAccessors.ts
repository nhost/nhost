import {
  colorForMethod,
  colorForStatus,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/constants';

// How a chart derives a series' key, legend label, and color from its labels.
// The three are always supplied together, so MetricChart and buildChart both
// take them as a single `accessors` object.
export interface SeriesAccessors {
  keyFor: (labels: Record<string, string>) => string;
  labelFor: (key: string, labels: Record<string, string>) => string;
  colorFor: (
    key: string,
    labels: Record<string, string>,
    index: number,
  ) => string;
}

// Every metric we query with `groupBy: [METHOD]` comes back as one series per
// method with a `method` label — the range metrics and the response-time
// histograms alike. So the `'unknown'` fallback is only a guard and never shows
// in practice.
export const METHOD_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => (labels.method ?? 'unknown').toLowerCase(),
  labelFor: (_key, labels) => labels.method ?? 'unknown',
  colorFor: (_key, labels, index) => colorForMethod(labels.method ?? '', index),
};

export const STATUS_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => `s${labels.status ?? 'unknown'}`,
  labelFor: (_key, labels) => labels.status ?? 'unknown',
  colorFor: (_key, labels) => colorForStatus(labels.status ?? ''),
};

// Pick the accessors a panel renders with from its label dimensions. Status-only
// panels colour by HTTP status; everything else (method-grouped, the common
// case) colours by method. Returns a stable module constant so chart memoization
// keyed on `accessors` stays stable across renders.
export function accessorsForPanel(labelDimensions: string[]): SeriesAccessors {
  const statusOnly =
    labelDimensions.includes('status') && !labelDimensions.includes('method');
  return statusOnly ? STATUS_SERIES_ACCESSORS : METHOD_SERIES_ACCESSORS;
}

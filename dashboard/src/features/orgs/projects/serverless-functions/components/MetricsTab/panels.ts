import type { ValueFormatterKind } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import type {
  FunctionMetricsResponse,
  MetricSeries,
} from '@/features/orgs/projects/serverless-functions/types';

// A chart panel, fully described in one place: how to label/format it, which
// label dimension splits its series, and how to pull its series out of the
// metrics response. Both the section grids and the expanded overlay derive
// everything they render from this — there is no second source of truth.
export interface MetricPanelConfig {
  title: string;
  description?: string;
  labelDimensions: string[];
  valueFormatterKind: ValueFormatterKind;
  select: (metrics: FunctionMetricsResponse) => MetricSeries[];
}

const PANELS = {
  invocations: {
    title: 'Invocations',
    description: 'Number of invocations by method',
    labelDimensions: ['method'],
    valueFormatterKind: 'integer',
    select: (m) => m.general.invocationsByMethod,
  },
  'response-status': {
    title: 'Response Status',
    description: 'Number of invocations by status response',
    labelDimensions: ['status'],
    valueFormatterKind: 'integer',
    select: (m) => m.general.responseStatus,
  },
  'avg-response-size': {
    title: 'Average Response Size',
    labelDimensions: ['method'],
    valueFormatterKind: 'bytes',
    select: (m) => m.general.averageResponseSize,
  },
  'response-time-max': {
    title: 'Maximum Response Time',
    description: 'Time the slowest response took',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
    select: (m) => m.responseTimes.max,
  },
  'response-time-p95': {
    title: 'Response times 95th percentile',
    description: '95% of responses complete within this time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
    select: (m) => m.responseTimes.p95,
  },
  'response-time-p75': {
    title: 'Response times 75th percentile',
    description: '75% of responses complete within this time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
    select: (m) => m.responseTimes.p75,
  },
  'response-time-avg': {
    title: 'Average Response Time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
    select: (m) => m.responseTimes.avg,
  },
  'error-rate': {
    title: 'Error Rate',
    description: 'Failed invocations as a share of total invocations',
    labelDimensions: ['method'],
    valueFormatterKind: 'percent-unit',
    select: (m) => m.errors.errorRate,
  },
} satisfies Record<string, MetricPanelConfig>;

export type MetricPanelSlug = keyof typeof PANELS;

// Re-typed as a uniform Record so callers get `MetricPanelConfig` (with optional
// `description`) on lookup, while `MetricPanelSlug` above is still derived from
// the literal keys — one source of truth, no hand-maintained slug list.
export const METRIC_PANELS: Record<MetricPanelSlug, MetricPanelConfig> = PANELS;

export function isMetricPanelSlug(value: unknown): value is MetricPanelSlug {
  return typeof value === 'string' && Object.hasOwn(METRIC_PANELS, value);
}

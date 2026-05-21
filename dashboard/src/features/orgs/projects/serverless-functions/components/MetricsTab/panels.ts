import type {
  MetricPanelConfig,
  MetricPanelSlug,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';

export const METRIC_PANELS: Record<MetricPanelSlug, MetricPanelConfig> = {
  invocations: {
    slug: 'invocations',
    title: 'Invocations',
    description: 'Number of invocations by method',
    labelDimensions: ['method'],
    valueFormatterKind: 'integer',
  },
  'response-status': {
    slug: 'response-status',
    title: 'Response Status',
    description: 'Number of invocations by status response',
    labelDimensions: ['status'],
    valueFormatterKind: 'integer',
  },
  'avg-response-size': {
    slug: 'avg-response-size',
    title: 'Average Response Size',
    labelDimensions: ['method'],
    valueFormatterKind: 'bytes',
  },
  'response-time-max': {
    slug: 'response-time-max',
    title: 'Maximum Response Time',
    description: 'Time the slowest response took',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
  },
  'response-time-p95': {
    slug: 'response-time-p95',
    title: 'Response times 95th percentile',
    description: '95% of responses complete within this time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
  },
  'response-time-p75': {
    slug: 'response-time-p75',
    title: 'Response times 75th percentile',
    description: '75% of responses complete within this time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
  },
  'response-time-avg': {
    slug: 'response-time-avg',
    title: 'Average Response Time',
    labelDimensions: ['method'],
    valueFormatterKind: 'ms',
  },
  'error-rate': {
    slug: 'error-rate',
    title: 'Error Rate',
    description: 'Failed invocations as a share of total invocations',
    labelDimensions: ['method'],
    valueFormatterKind: 'percent-unit',
  },
};

export function humanizeLabelDimension(dim: string): string {
  if (!dim) {
    return '';
  }
  return dim.charAt(0).toUpperCase() + dim.slice(1);
}

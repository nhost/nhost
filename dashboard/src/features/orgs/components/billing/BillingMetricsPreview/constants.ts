import type { BillingUsageReportType } from '@/features/orgs/components/billing/BillingMetricsPreview/types';

export const BILLING_USAGE_HISTORY_DAYS = 60;

export const DELETED_PROJECTS_GROUP_THRESHOLD = 5;

export const BILLING_USAGE_REPORT_LABELS: Record<
  BillingUsageReportType,
  string
> = {
  egress: 'Egress',
  functions: 'Function duration',
  dedicatedCompute: 'Compute',
};

export const BILLING_USAGE_REFERENCE_LINES: Record<
  BillingUsageReportType,
  { value: number; label: string }
> = {
  egress: { value: 50_000, label: 'Included usage' },
  functions: { value: 36_000, label: 'Included usage' },
  dedicatedCompute: {
    value: 12_500_000,
    label: 'Approx. $15 compute credit',
  },
};

export const BILLING_USAGE_REPORT_UNITS: Record<
  BillingUsageReportType,
  string
> = {
  egress: 'MB',
  functions: 'seconds',
  dedicatedCompute: 'millicore-minutes',
};

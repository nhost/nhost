import type {
  BillingUsageRangePreset,
  BillingUsageReportType,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const BILLING_USAGE_HISTORY_DAYS = 60;

export const BILLING_USAGE_RETENTION_MESSAGE = `Usage reports are retained for at most ${BILLING_USAGE_HISTORY_DAYS} days.`;

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

export const DEFAULT_BILLING_USAGE_TIME_RANGE: BillingUsageTimeRange = {
  kind: 'preset',
  preset: 'currentBillingCycle',
};

export const BILLING_USAGE_PRESET_LABELS: Record<
  BillingUsageRangePreset,
  string
> = {
  currentBillingCycle: 'Current billing cycle',
  previousBillingCycle: 'Previous billing cycle',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '60d': 'Last 60 days',
};

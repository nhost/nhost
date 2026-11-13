import type {
  BillingUsageRangePreset,
  BillingUsageReportType,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';

export const BILLING_USAGE_HISTORY_DAYS = 95;

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
  { value: number; describe: (amount: string) => string }
> = {
  egress: { value: 50_000, describe: (amount) => `the ${amount} included` },
  functions: { value: 36_000, describe: (amount) => `the ${amount} included` },
  dedicatedCompute: {
    value: 12_500,
    describe: (amount) => `the $15 credit (about ${amount})`,
  },
};

export const BILLING_USAGE_REPORT_UNITS: Record<
  BillingUsageReportType,
  string
> = {
  egress: 'MB',
  functions: 'seconds',
  dedicatedCompute: 'vCPU-minutes',
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

import type {
  BillingServiceKey,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';

export const BILLING_USAGE_HISTORY_DAYS = 60;

export const BILLING_SERVICE_LABELS: Record<BillingServiceKey, string> = {
  plan: 'Plan',
  dedicatedCompute: 'Compute',
  egress: 'Egress',
  functionDuration: 'Function duration',
  deployedFunctions: 'Deployed functions',
  persistentVolume: 'Persistent volume',
  customDomains: 'Custom domains',
  pitr: 'Point-in-time recovery',
};

export const BILLING_SERVICE_COLORS: Record<BillingServiceKey, string> = {
  plan: 'hsl(var(--primary))',
  dedicatedCompute: 'hsl(173 80% 40%)',
  egress: 'hsl(189 95% 43%)',
  functionDuration: 'hsl(25 95% 53%)',
  deployedFunctions: 'hsl(31 97% 72%)',
  persistentVolume: 'hsl(213 94% 68%)',
  customDomains: 'hsl(350 89% 60%)',
  pitr: 'hsl(224 76% 48%)',
};

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

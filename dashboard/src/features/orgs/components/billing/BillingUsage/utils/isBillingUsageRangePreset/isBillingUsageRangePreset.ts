import {
  BILLING_USAGE_RANGE_PRESETS,
  type BillingUsageRangePreset,
} from '@/features/orgs/components/billing/BillingUsage/types';

export default function isBillingUsageRangePreset(
  value: unknown,
): value is BillingUsageRangePreset {
  return (
    typeof value === 'string' &&
    (BILLING_USAGE_RANGE_PRESETS as readonly string[]).includes(value)
  );
}

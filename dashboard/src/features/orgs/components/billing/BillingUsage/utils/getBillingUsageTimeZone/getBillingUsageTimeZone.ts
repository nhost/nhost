import type { BillingUsageTimeZone } from '@/features/orgs/components/billing/BillingUsage/types';
import { guessTimezone } from '@/utils/timezoneUtils';

export default function getBillingUsageTimeZone(
  timeZone: BillingUsageTimeZone,
): string {
  return timeZone === 'utc' ? 'UTC' : guessTimezone();
}

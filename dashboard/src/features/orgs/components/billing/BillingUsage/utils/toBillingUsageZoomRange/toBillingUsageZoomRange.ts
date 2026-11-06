import { DAY_MS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageRangeBounds,
  BillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';

export default function toBillingUsageZoomRange(
  firstDay: number,
  lastDay: number,
  bounds: BillingUsageRangeBounds,
): BillingUsageTimeRange {
  const from = Math.max(
    startOfUtcDay(firstDay),
    new Date(bounds.min).getTime(),
  );
  const to = Math.min(
    startOfUtcDay(lastDay) + DAY_MS - 1,
    new Date(bounds.max).getTime(),
  );
  return {
    kind: 'absolute',
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
  };
}

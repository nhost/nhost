import type {
  BillingUsageBucket,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';

// Ranges start and end at midnight or when a billing cycle does, and a bucket
// always has its middle inside its own day, so its middle tells which side of
// either kind of boundary the bucket is on.
export default function isBillingUsageBucketInRange(
  { start, end }: BillingUsageBucket,
  { from, to }: ResolvedBillingUsageTimeRange,
): boolean {
  const middle = (start + end) / 2;
  return middle >= from.getTime() && middle < to.getTime();
}

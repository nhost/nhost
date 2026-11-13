import type {
  BillingUsageBucket,
  ResolvedBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { isBillingUsageBucketInRange } from '@/features/orgs/components/billing/BillingUsage/utils/isBillingUsageBucketInRange';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

// Keeps the days the range shows. The series and the buckets are
// index-aligned.
export default function sliceBillingUsageSeries(
  series: MetricSeries[],
  buckets: BillingUsageBucket[],
  range: ResolvedBillingUsageTimeRange,
): MetricSeries[] {
  const includedIndexes = buckets
    .map((bucket, index) => ({ bucket, index }))
    .filter(({ bucket }) => isBillingUsageBucketInRange(bucket, range))
    .map(({ index }) => index);

  return series.map((item) => ({
    ...item,
    timestamps: includedIndexes.map((index) => item.timestamps[index]),
    datapoints: includedIndexes.map((index) => item.datapoints[index]),
  }));
}

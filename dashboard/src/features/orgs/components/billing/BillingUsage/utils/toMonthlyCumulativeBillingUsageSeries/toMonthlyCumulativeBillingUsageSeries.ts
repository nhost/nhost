import type { BillingUsageBucket } from '@/features/orgs/components/billing/BillingUsage/types';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

// Turns bucket totals into cycle-to-date totals, starting again with each
// billing cycle. The series and the buckets are index-aligned.
export default function toMonthlyCumulativeBillingUsageSeries(
  dailySeries: MetricSeries[],
  buckets: BillingUsageBucket[],
): MetricSeries[] {
  return dailySeries.map((series) => {
    let runningTotal = 0;
    const datapoints = series.datapoints.map((value, index) => {
      if (
        index > 0 &&
        buckets[index].cycleStart !== buckets[index - 1].cycleStart
      ) {
        runningTotal = 0;
      }
      runningTotal += value;
      return runningTotal;
    });

    return { ...series, datapoints };
  });
}

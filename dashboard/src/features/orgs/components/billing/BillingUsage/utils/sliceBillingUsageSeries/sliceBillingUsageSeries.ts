import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

export default function sliceBillingUsageSeries(
  series: MetricSeries[],
  from: Date,
  to: Date,
): MetricSeries[] {
  const fromDay = startOfUtcDay(from.getTime());
  const toDay = startOfUtcDay(to.getTime());

  return series.map((item) => {
    const includedIndexes = item.timestamps
      .map((timestamp, index) => ({
        index,
        value: new Date(timestamp).getTime(),
      }))
      .filter(({ value }) => value >= fromDay && value <= toDay)
      .map(({ index }) => index);

    return {
      ...item,
      timestamps: includedIndexes.map((index) => item.timestamps[index]),
      datapoints: includedIndexes.map((index) => item.datapoints[index]),
    };
  });
}

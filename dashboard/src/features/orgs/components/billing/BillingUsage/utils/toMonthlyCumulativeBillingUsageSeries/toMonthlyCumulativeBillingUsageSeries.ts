import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

export default function toMonthlyCumulativeBillingUsageSeries(
  dailySeries: MetricSeries[],
): MetricSeries[] {
  return dailySeries.map((series) => {
    let month = '';
    let runningTotal = 0;
    const datapoints = series.datapoints.map((value, index) => {
      const timestamp = new Date(series.timestamps[index]);
      const nextMonth = `${timestamp.getUTCFullYear()}-${timestamp.getUTCMonth()}`;
      if (nextMonth !== month) {
        month = nextMonth;
        runningTotal = 0;
      }
      runningTotal += value;
      return runningTotal;
    });

    return { ...series, datapoints };
  });
}

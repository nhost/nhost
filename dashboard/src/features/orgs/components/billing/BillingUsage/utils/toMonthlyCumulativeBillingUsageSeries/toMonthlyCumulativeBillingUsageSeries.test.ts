import { toBillingUsageBuckets } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBuckets';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import toMonthlyCumulativeBillingUsageSeries from './toMonthlyCumulativeBillingUsageSeries';

describe('toMonthlyCumulativeBillingUsageSeries', () => {
  it('starts the totals again with each billing cycle', () => {
    const buckets = toBillingUsageBuckets(
      {
        periodStart: '2026-07-30T07:00:00.000Z',
        periodEnd: '2026-08-03T07:00:00.000Z',
      },
      'America/Los_Angeles',
      '2026-09-01T00:00:00.000Z',
    );
    const series: MetricSeries = {
      labels: { projectID: 'alpha' },
      timestamps: buckets.map((bucket) =>
        new Date(bucket.timestamp).toISOString(),
      ),
      datapoints: [1, 2, 3, 4],
    };

    expect(
      toMonthlyCumulativeBillingUsageSeries([series], buckets)[0].datapoints,
    ).toEqual([1, 3, 3, 7]);
  });
});

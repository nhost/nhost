import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import toMonthlyCumulativeBillingUsageSeries from './toMonthlyCumulativeBillingUsageSeries';

describe('toMonthlyCumulativeBillingUsageSeries', () => {
  it('resets month-to-date totals at the UTC month boundary', () => {
    const daily: MetricSeries = {
      labels: { projectID: 'alpha' },
      timestamps: [
        '2026-07-30T00:00:00.000Z',
        '2026-07-31T00:00:00.000Z',
        '2026-08-01T00:00:00.000Z',
        '2026-08-02T00:00:00.000Z',
      ],
      datapoints: [1, 2, 3, 4],
    };

    expect(
      toMonthlyCumulativeBillingUsageSeries([daily])[0].datapoints,
    ).toEqual([1, 3, 3, 7]);
  });
});

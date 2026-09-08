import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  BILLING_USAGE_SERIES_ACCESSORS,
  getBillingUsagePeriod,
  summarizeBillingUsageSeries,
  toDailyBillingUsageSeries,
  toMonthlyCumulativeBillingUsageSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toBillingUsageSeries';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

const reports: BillingUsageReport[] = [
  {
    id: 'a-1',
    projectID: 'project-a',
    projectName: 'Alpha',
    type: 'egress',
    value: 10,
    reportStarts: '2026-08-02T20:00:00.000Z',
    reportEnds: '2026-08-03T00:00:00.000Z',
    pending: false,
  },
  {
    id: 'a-2',
    projectID: 'project-a',
    projectName: 'Alpha',
    type: 'egress',
    value: 15,
    reportStarts: '2026-08-05T20:00:00.000Z',
    reportEnds: '2026-08-06T00:00:00.000Z',
    pending: true,
  },
  {
    id: 'b-1',
    projectID: 'project-b',
    projectName: 'Beta',
    type: 'egress',
    value: 20,
    reportStarts: '2026-08-09T20:00:00.000Z',
    reportEnds: '2026-08-10T00:00:00.000Z',
    pending: false,
  },
  {
    id: 'other-meter',
    projectID: 'project-a',
    projectName: 'Alpha',
    type: 'functions',
    value: 999,
    reportStarts: '2026-08-05T20:00:00.000Z',
    reportEnds: '2026-08-06T00:00:00.000Z',
    pending: false,
  },
];

const PERIOD_TIMESTAMPS = [
  '2026-08-03T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z',
  '2026-08-05T00:00:00.000Z',
  '2026-08-06T00:00:00.000Z',
  '2026-08-07T00:00:00.000Z',
  '2026-08-08T00:00:00.000Z',
  '2026-08-09T00:00:00.000Z',
  '2026-08-10T00:00:00.000Z',
];

describe('toDailyBillingUsageSeries', () => {
  it('creates calendar-aligned UTC daily totals by project', () => {
    expect(
      toDailyBillingUsageSeries(
        reports,
        'egress',
        PERIOD_TIMESTAMPS[0],
        '2026-08-11T00:00:00.000Z',
      ),
    ).toEqual([
      {
        labels: { projectID: 'project-a', projectName: 'Alpha' },
        timestamps: PERIOD_TIMESTAMPS,
        datapoints: [10, 0, 0, 15, 0, 0, 0, 0],
      },
      {
        labels: { projectID: 'project-b', projectName: 'Beta' },
        timestamps: PERIOD_TIMESTAMPS,
        datapoints: [0, 0, 0, 0, 0, 0, 0, 20],
      },
    ]);
  });

  it('resolves a fixed retained window from the latest valid report', () => {
    expect(getBillingUsagePeriod(reports, 3)).toEqual({
      periodStart: '2026-08-08T00:00:00.000Z',
      periodEnd: '2026-08-11T00:00:00.000Z',
      latestDay: new Date('2026-08-10T00:00:00.000Z').getTime(),
      latestReportEnd: '2026-08-10T00:00:00.000Z',
    });
    expect(getBillingUsagePeriod([], 60)).toBeUndefined();
  });

  it('resets cumulative project totals at each UTC month boundary', () => {
    const dailySeries: MetricSeries[] = [
      {
        labels: { projectID: 'project-a', projectName: 'Alpha' },
        timestamps: [
          '2026-07-30T00:00:00.000Z',
          '2026-07-31T00:00:00.000Z',
          '2026-08-01T00:00:00.000Z',
          '2026-08-02T00:00:00.000Z',
        ],
        datapoints: [1, 2, 3, 4],
      },
    ];

    expect(
      toMonthlyCumulativeBillingUsageSeries(dailySeries)[0].datapoints,
    ).toEqual([1, 3, 3, 7]);
  });

  it('summarizes raw totals and top-project share without double counting', () => {
    const dailySeries = toDailyBillingUsageSeries(
      reports,
      'egress',
      PERIOD_TIMESTAMPS[0],
      '2026-08-11T00:00:00.000Z',
    );

    expect(summarizeBillingUsageSeries(dailySeries)).toEqual({
      total: 45,
      topProject: { name: 'Alpha', total: 25, percentage: 56 },
    });
  });

  it('keeps project colors stable across series order', () => {
    const labels = { projectID: 'project-a', projectName: 'Alpha' };

    expect(BILLING_USAGE_SERIES_ACCESSORS.keyFor(labels)).toBe(
      'project-project-a',
    );
    expect(
      BILLING_USAGE_SERIES_ACCESSORS.colorFor('project-project-a', labels, 0),
    ).toBe(
      BILLING_USAGE_SERIES_ACCESSORS.colorFor('project-project-a', labels, 8),
    );
  });

  it('ignores invalid report and period timestamps', () => {
    expect(
      toDailyBillingUsageSeries(
        [{ ...reports[0], reportEnds: 'invalid' }],
        'egress',
        PERIOD_TIMESTAMPS[0],
        '2026-08-11T00:00:00.000Z',
      ),
    ).toEqual([]);
    expect(
      toDailyBillingUsageSeries(reports, 'egress', 'invalid', 'also-invalid'),
    ).toEqual([]);
  });
});

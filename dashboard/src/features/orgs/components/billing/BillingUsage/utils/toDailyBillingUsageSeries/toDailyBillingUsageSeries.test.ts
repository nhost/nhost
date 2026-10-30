import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
import { toBillingUsageBuckets } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBuckets';
import toDailyBillingUsageSeries from './toDailyBillingUsageSeries';

function report(
  overrides: Partial<BillingUsageReport> &
    Pick<BillingUsageReport, 'value' | 'reportEnds'>,
): BillingUsageReport {
  return {
    projectID: 'alpha',
    projectName: 'Alpha',
    isDeleted: false,
    type: 'egress',
    ...overrides,
  };
}

const DELETED = { projectID: 'gone', projectName: 'gone', isDeleted: true };

const UTC_DAYS = toBillingUsageBuckets(
  {
    periodStart: '2026-08-08T00:00:00.000Z',
    periodEnd: '2026-08-11T00:00:00.000Z',
  },
  'UTC',
  '2026-09-01T00:00:00.000Z',
);

describe('toDailyBillingUsageSeries', () => {
  it('sums the reports of one type into the days of the period', () => {
    const reports = [
      report({ value: 1000, reportEnds: '2026-08-07T12:00:00.000Z' }),
      report({ value: 10, reportEnds: '2026-08-09T20:00:00.000Z' }),
      report({ value: 20, reportEnds: '2026-08-10T04:00:00.000Z' }),
      report({ value: 30, reportEnds: '2026-08-10T08:00:00.000Z' }),
      report({ ...DELETED, value: 40, reportEnds: '2026-08-10T04:00:00.000Z' }),
      report({
        type: 'functions',
        value: 999,
        reportEnds: '2026-08-10T04:00:00.000Z',
      }),
    ];
    const timestamps = [
      '2026-08-08T12:00:00.000Z',
      '2026-08-09T12:00:00.000Z',
      '2026-08-10T12:00:00.000Z',
    ];

    expect(toDailyBillingUsageSeries(reports, 'egress', UTC_DAYS)).toEqual([
      {
        labels: {
          projectID: 'alpha',
          projectName: 'Alpha',
          projectKind: 'active',
        },
        timestamps,
        datapoints: [0, 10, 50],
      },
      {
        labels: {
          projectID: 'gone',
          projectName: 'gone',
          projectKind: 'deleted',
        },
        timestamps,
        datapoints: [0, 0, 40],
      },
    ]);
  });

  it('puts a report in the day of the billing cycle it belongs to', () => {
    // Sep 30 and Oct 1 in Los Angeles, where October starts on Sep 30 at 5 PM.
    const losAngelesDays = toBillingUsageBuckets(
      {
        periodStart: '2026-09-30T07:00:00.000Z',
        periodEnd: '2026-10-02T07:00:00.000Z',
      },
      'America/Los_Angeles',
      '2026-11-01T00:00:00.000Z',
    );
    const reports = [
      report({ value: 1, reportEnds: '2026-09-30T20:00:00.000Z' }),
      report({ value: 2, reportEnds: '2026-10-01T04:00:00.000Z' }),
    ];

    expect(
      toDailyBillingUsageSeries(reports, 'egress', losAngelesDays)[0]
        .datapoints,
    ).toEqual([1, 2]);
  });

  it('lists active projects by name, then deleted ones', () => {
    const reportEnds = '2026-08-09T12:00:00.000Z';
    const reports = [
      report({ ...DELETED, value: 1, reportEnds }),
      report({ projectID: 'b-id', projectName: 'Beta', value: 1, reportEnds }),
      report({ projectID: 'c-id', projectName: 'Alpha', value: 1, reportEnds }),
    ];

    expect(
      toDailyBillingUsageSeries(reports, 'egress', UTC_DAYS).map(
        (series) => series.labels.projectName,
      ),
    ).toEqual(['Alpha', 'Beta', 'gone']);
  });
});

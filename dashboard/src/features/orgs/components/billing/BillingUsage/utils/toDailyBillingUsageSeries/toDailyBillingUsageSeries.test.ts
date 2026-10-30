import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';
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

describe('toDailyBillingUsageSeries', () => {
  it('sums the reports of one type into the UTC days of the period', () => {
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

    expect(
      toDailyBillingUsageSeries(
        reports,
        'egress',
        '2026-08-08T00:00:00.000Z',
        '2026-08-11T00:00:00.000Z',
      ),
    ).toEqual([
      {
        labels: {
          projectID: 'alpha',
          projectName: 'Alpha',
          projectKind: 'active',
        },
        timestamps: [
          '2026-08-08T00:00:00.000Z',
          '2026-08-09T00:00:00.000Z',
          '2026-08-10T00:00:00.000Z',
        ],
        datapoints: [0, 10, 50],
      },
      {
        labels: {
          projectID: 'gone',
          projectName: 'gone',
          projectKind: 'deleted',
        },
        timestamps: [
          '2026-08-08T00:00:00.000Z',
          '2026-08-09T00:00:00.000Z',
          '2026-08-10T00:00:00.000Z',
        ],
        datapoints: [0, 0, 40],
      },
    ]);
  });

  it('lists active projects by name, then deleted ones', () => {
    const reportEnds = '2026-08-09T12:00:00.000Z';
    const reports = [
      report({ ...DELETED, value: 1, reportEnds }),
      report({ projectID: 'b-id', projectName: 'Beta', value: 1, reportEnds }),
      report({ projectID: 'c-id', projectName: 'Alpha', value: 1, reportEnds }),
    ];

    expect(
      toDailyBillingUsageSeries(
        reports,
        'egress',
        '2026-08-09T00:00:00.000Z',
        '2026-08-10T00:00:00.000Z',
      ).map((series) => series.labels.projectName),
    ).toEqual(['Alpha', 'Beta', 'gone']);
  });
});

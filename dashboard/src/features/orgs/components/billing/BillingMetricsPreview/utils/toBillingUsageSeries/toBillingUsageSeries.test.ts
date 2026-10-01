import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  getBillingUsagePeriod,
  groupDeletedProjectSeries,
  summarizeBillingUsageSeries,
  toDailyBillingUsageSeries,
  toMonthlyCumulativeBillingUsageSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toBillingUsageSeries';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

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

describe('billing usage series', () => {
  it('sums reports into UTC days within the retained window and summarizes them', () => {
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
    const period = getBillingUsagePeriod(reports, 3);
    if (!period) {
      throw new Error('expected a usage period');
    }

    const series = toDailyBillingUsageSeries(
      reports,
      'egress',
      period.periodStart,
      period.periodEnd,
    );

    expect(series).toEqual([
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
    expect(summarizeBillingUsageSeries(series)).toEqual({
      total: 100,
      topProject: {
        projectID: 'alpha',
        name: 'Alpha',
        isDeleted: false,
        total: 60,
        percentage: 60,
      },
      deletedProjects: { count: 1, total: 40, percentage: 40 },
    });
  });

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

  it('folds more than five deleted projects into one summed series', () => {
    const timestamps = ['2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'];
    const active: MetricSeries = {
      labels: { projectID: 'alpha', projectKind: 'active' },
      timestamps,
      datapoints: [7, 7],
    };
    const deleted: MetricSeries[] = Array.from({ length: 6 }, (_, index) => ({
      labels: { projectID: `gone-${index}`, projectKind: 'deleted' },
      timestamps,
      datapoints: [index, 1],
    }));

    expect(groupDeletedProjectSeries([active, ...deleted])).toEqual([
      active,
      {
        labels: {
          projectID: 'deleted-projects',
          projectName: 'Deleted projects (6)',
          projectKind: 'deletedGroup',
          deletedProjectCount: '6',
        },
        timestamps,
        datapoints: [15, 6],
      },
    ]);
  });
});

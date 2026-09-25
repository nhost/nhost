import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  BILLING_USAGE_SERIES_ACCESSORS,
  type BillingUsageProjectKind,
  deletedProjectIDsFor,
  getBillingUsagePeriod,
  groupDeletedProjectSeries,
  summarizeBillingUsageSeries,
  toDailyBillingUsageSeries,
  toMonthlyCumulativeBillingUsageSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toBillingUsageSeries';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

const TEST_APP_IDS = [
  '3f5c64ec-9172-4c34-8a7e-c84b3b6e78b9',
  '9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96',
];

const TEST_DELETED_APP_IDS = [
  '04bc2db3-a948-48fb-b674-7a8a0133dd2b',
  'a486b088-50e8-41d0-88b0-5bf9a3e7b5e7',
  'c7fbf7ad-b60c-432b-86c2-5a9509054c47',
  'cd2b77ac-3ef1-4a76-819b-ff1caca09213',
  'cda96570-e636-4028-a729-ac97157faff9',
  'd44dc594-022f-4aa7-84b2-0cebee5f1d13',
  'dc5e805e-1bef-4d43-809e-9fdf865e211a',
];

const reports: BillingUsageReport[] = [
  {
    projectID: TEST_APP_IDS[0],
    projectName: 'Alpha',
    isDeleted: false,
    type: 'egress',
    value: 10,
    reportEnds: '2026-08-03T00:00:00.000Z',
  },
  {
    projectID: TEST_APP_IDS[0],
    projectName: 'Alpha',
    isDeleted: false,
    type: 'egress',
    value: 15,
    reportEnds: '2026-08-06T00:00:00.000Z',
  },
  {
    projectID: TEST_APP_IDS[1],
    projectName: 'Beta',
    isDeleted: false,
    type: 'egress',
    value: 20,
    reportEnds: '2026-08-10T00:00:00.000Z',
  },
  {
    projectID: TEST_APP_IDS[0],
    projectName: 'Alpha',
    isDeleted: false,
    type: 'functions',
    value: 999,
    reportEnds: '2026-08-06T00:00:00.000Z',
  },
];

const deletedReport: BillingUsageReport = {
  projectID: TEST_DELETED_APP_IDS[0],
  projectName: TEST_DELETED_APP_IDS[0],
  isDeleted: true,
  type: 'egress',
  value: 5,
  reportEnds: '2026-08-04T00:00:00.000Z',
};

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

function projectSeries(
  projectID: string,
  projectKind: BillingUsageProjectKind,
  datapoints: number[],
  projectName: string = projectID,
): MetricSeries {
  return {
    labels: { projectID, projectName, projectKind },
    timestamps: PERIOD_TIMESTAMPS.slice(0, datapoints.length),
    datapoints,
  };
}

function deletedSeries(count: number): MetricSeries[] {
  return Array.from({ length: count }, (_value, index) =>
    projectSeries(TEST_DELETED_APP_IDS[index], 'deleted', [index, 1]),
  );
}

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
        labels: {
          projectID: TEST_APP_IDS[0],
          projectName: 'Alpha',
          projectKind: 'active',
        },
        timestamps: PERIOD_TIMESTAMPS,
        datapoints: [10, 0, 0, 15, 0, 0, 0, 0],
      },
      {
        labels: {
          projectID: TEST_APP_IDS[1],
          projectName: 'Beta',
          projectKind: 'active',
        },
        timestamps: PERIOD_TIMESTAMPS,
        datapoints: [0, 0, 0, 0, 0, 0, 0, 20],
      },
    ]);
  });

  it('marks deleted projects and orders them after active projects', () => {
    const series = toDailyBillingUsageSeries(
      [deletedReport, ...reports],
      'egress',
      PERIOD_TIMESTAMPS[0],
      '2026-08-11T00:00:00.000Z',
    );

    expect(series.map((item) => item.labels)).toEqual([
      {
        projectID: TEST_APP_IDS[0],
        projectName: 'Alpha',
        projectKind: 'active',
      },
      {
        projectID: TEST_APP_IDS[1],
        projectName: 'Beta',
        projectKind: 'active',
      },
      {
        projectID: TEST_DELETED_APP_IDS[0],
        projectName: TEST_DELETED_APP_IDS[0],
        projectKind: 'deleted',
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
        labels: { projectID: TEST_APP_IDS[0], projectName: 'Alpha' },
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

  it('keeps project colors stable across series order', () => {
    const labels = { projectID: TEST_APP_IDS[0], projectName: 'Alpha' };

    const key = BILLING_USAGE_SERIES_ACCESSORS.keyFor(labels);

    expect(key).toBe(`project-${TEST_APP_IDS[0]}`);
    expect(BILLING_USAGE_SERIES_ACCESSORS.colorFor(key, labels, 0)).toBe(
      BILLING_USAGE_SERIES_ACCESSORS.colorFor(key, labels, 8),
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

describe('groupDeletedProjectSeries', () => {
  it('keeps up to five deleted projects as separate series', () => {
    const series = [
      projectSeries(TEST_APP_IDS[0], 'active', [1, 2], 'Alpha'),
      ...deletedSeries(5),
    ];

    expect(groupDeletedProjectSeries(series)).toBe(series);
  });

  it('folds more than five deleted projects into one summed series after the active ones', () => {
    const active = projectSeries(TEST_APP_IDS[0], 'active', [1, 2], 'Alpha');

    const grouped = groupDeletedProjectSeries([active, ...deletedSeries(6)]);

    expect(grouped).toEqual([
      active,
      {
        labels: {
          projectID: 'deleted-projects',
          projectName: 'Deleted projects',
          projectKind: 'deletedGroup',
          deletedProjectIDs: TEST_DELETED_APP_IDS.slice(0, 6).join(','),
        },
        timestamps: PERIOD_TIMESTAMPS.slice(0, 2),
        datapoints: [0 + 1 + 2 + 3 + 4 + 5, 6],
      },
    ]);
    expect(deletedProjectIDsFor(grouped[1].labels)).toEqual(
      TEST_DELETED_APP_IDS.slice(0, 6),
    );
  });

  it('keeps month-to-date totals consistent with the ungrouped projects', () => {
    const ungrouped = deletedSeries(6);
    const ungroupedTotal = toMonthlyCumulativeBillingUsageSeries(
      ungrouped,
    ).reduce((sum, series) => sum + series.datapoints[1], 0);

    const [group] = toMonthlyCumulativeBillingUsageSeries(
      groupDeletedProjectSeries(ungrouped),
    );

    expect(group.datapoints[1]).toBe(ungroupedTotal);
  });
});

describe('BILLING_USAGE_SERIES_ACCESSORS', () => {
  it('labels deleted projects with a trimmed ID and groups with their count', () => {
    const deleted = projectSeries(
      TEST_DELETED_APP_IDS[0],
      'deleted',
      [1],
    ).labels;
    const [group] = groupDeletedProjectSeries(deletedSeries(7));

    expect(BILLING_USAGE_SERIES_ACCESSORS.labelFor('key', deleted)).toBe(
      'Deleted · 04bc2db3…dd2b',
    );
    expect(BILLING_USAGE_SERIES_ACCESSORS.labelFor('key', group.labels)).toBe(
      'Deleted projects (7)',
    );
  });

  it('mutes deleted project colors', () => {
    const active = projectSeries(
      TEST_APP_IDS[0],
      'active',
      [1],
      'Alpha',
    ).labels;
    const deleted = projectSeries(
      TEST_DELETED_APP_IDS[0],
      'deleted',
      [1],
    ).labels;
    const [group] = groupDeletedProjectSeries(deletedSeries(6));

    expect(BILLING_USAGE_SERIES_ACCESSORS.colorFor('key', active, 0)).toMatch(
      / 65% 50%\)$/,
    );
    expect(BILLING_USAGE_SERIES_ACCESSORS.colorFor('key', deleted, 0)).toMatch(
      / 20% 60%\)$/,
    );
    expect(
      BILLING_USAGE_SERIES_ACCESSORS.colorFor('key', group.labels, 0),
    ).toBe('hsl(var(--muted-foreground))');
  });
});

describe('summarizeBillingUsageSeries', () => {
  it('summarizes raw totals and top-project share without double counting', () => {
    const dailySeries = toDailyBillingUsageSeries(
      reports,
      'egress',
      PERIOD_TIMESTAMPS[0],
      '2026-08-11T00:00:00.000Z',
    );

    expect(summarizeBillingUsageSeries(dailySeries)).toEqual({
      total: 45,
      topProject: {
        projectID: TEST_APP_IDS[0],
        name: 'Alpha',
        isDeleted: false,
        total: 25,
        percentage: 56,
      },
    });
  });

  it('reports the share of deleted projects that used the meter', () => {
    const summary = summarizeBillingUsageSeries([
      projectSeries(TEST_APP_IDS[0], 'active', [60, 0], 'Alpha'),
      projectSeries(TEST_DELETED_APP_IDS[0], 'deleted', [30, 0]),
      projectSeries(TEST_DELETED_APP_IDS[1], 'deleted', [0, 10]),
      projectSeries(TEST_DELETED_APP_IDS[2], 'deleted', [0, 0]),
    ]);

    expect(summary.deletedProjects).toEqual({
      count: 2,
      total: 40,
      percentage: 40,
    });
  });

  it('can name a single deleted project as the top project', () => {
    const summary = summarizeBillingUsageSeries([
      projectSeries(TEST_APP_IDS[0], 'active', [10], 'Alpha'),
      projectSeries(TEST_DELETED_APP_IDS[0], 'deleted', [30]),
    ]);

    expect(summary.topProject).toEqual({
      projectID: TEST_DELETED_APP_IDS[0],
      name: TEST_DELETED_APP_IDS[0],
      isDeleted: true,
      total: 30,
      percentage: 75,
    });
  });

  it('omits the top project when nothing was used', () => {
    expect(
      summarizeBillingUsageSeries([
        projectSeries(TEST_APP_IDS[0], 'active', [0], 'Alpha'),
      ]),
    ).toEqual({ total: 0 });
  });
});

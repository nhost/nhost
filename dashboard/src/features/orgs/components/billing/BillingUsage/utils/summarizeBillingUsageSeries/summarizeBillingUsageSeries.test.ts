import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import summarizeBillingUsageSeries from './summarizeBillingUsageSeries';

const timestamps = [
  '2026-08-08T00:00:00.000Z',
  '2026-08-09T00:00:00.000Z',
  '2026-08-10T00:00:00.000Z',
];

const series: MetricSeries[] = [
  {
    labels: { projectID: 'alpha', projectName: 'Alpha', projectKind: 'active' },
    timestamps,
    datapoints: [0, 10, 50],
  },
  {
    labels: { projectID: 'gone', projectName: 'gone', projectKind: 'deleted' },
    timestamps,
    datapoints: [0, 0, 40],
  },
];

describe('summarizeBillingUsageSeries', () => {
  it('totals the usage and names the top project and the deleted share', () => {
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
});

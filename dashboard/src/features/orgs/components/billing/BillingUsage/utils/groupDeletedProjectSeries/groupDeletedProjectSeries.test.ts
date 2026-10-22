import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import groupDeletedProjectSeries from './groupDeletedProjectSeries';

describe('groupDeletedProjectSeries', () => {
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

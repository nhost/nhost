import { DELETED_PROJECTS_GROUP_THRESHOLD } from '@/features/orgs/components/billing/BillingUsage/constants';
import type { BillingUsageProjectKind } from '@/features/orgs/components/billing/BillingUsage/types';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

const DELETED_PROJECTS_GROUP_ID = 'deleted-projects';

// Folds deleted projects into a single series once there are more than
// DELETED_PROJECTS_GROUP_THRESHOLD of them, so the legend stays readable. Daily
// series share one timeline, so the group is summed index by index.
export default function groupDeletedProjectSeries(
  dailySeries: MetricSeries[],
): MetricSeries[] {
  const deletedSeries = dailySeries.filter(
    (series) => series.labels.projectKind === 'deleted',
  );
  if (deletedSeries.length <= DELETED_PROJECTS_GROUP_THRESHOLD) {
    return dailySeries;
  }

  const { timestamps } = deletedSeries[0];
  return [
    ...dailySeries.filter((series) => series.labels.projectKind !== 'deleted'),
    {
      labels: {
        projectID: DELETED_PROJECTS_GROUP_ID,
        projectName: `Deleted projects (${deletedSeries.length})`,
        projectKind: 'deletedGroup' satisfies BillingUsageProjectKind,
        deletedProjectCount: String(deletedSeries.length),
      },
      timestamps,
      datapoints: timestamps.map((_timestamp, index) =>
        deletedSeries.reduce(
          (sum, series) => sum + (series.datapoints[index] ?? 0),
          0,
        ),
      ),
    },
  ];
}

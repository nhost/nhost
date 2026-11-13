import type {
  BillingUsageBucket,
  BillingUsageProjectKind,
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { compareBillingProjects } from '@/features/orgs/components/billing/BillingUsage/utils/compareBillingProjects';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

// Sums each project's reports of one type into the bucket its report ended in.
export default function toDailyBillingUsageSeries(
  reports: BillingUsageReport[],
  type: BillingUsageReportType,
  buckets: BillingUsageBucket[],
): MetricSeries[] {
  const byProject = new Map<
    string,
    { projectName: string; isDeleted: boolean; totals: number[] }
  >();

  reports.forEach((report) => {
    if (report.type !== type) {
      return;
    }
    const reportEnd = new Date(report.reportEnds).getTime();
    const index = buckets.findIndex(
      (bucket) => reportEnd >= bucket.start && reportEnd < bucket.end,
    );
    if (index === -1) {
      return;
    }

    const current = byProject.get(report.projectID) ?? {
      projectName: report.projectName,
      isDeleted: report.isDeleted,
      totals: buckets.map(() => 0),
    };
    current.totals[index] += report.value;
    byProject.set(report.projectID, current);
  });

  const timestamps = buckets.map((bucket) =>
    new Date(bucket.timestamp).toISOString(),
  );

  return Array.from(byProject.entries())
    .sort(([, projectA], [, projectB]) =>
      compareBillingProjects(projectA, projectB),
    )
    .map(([projectID, project]) => ({
      labels: {
        projectID,
        projectName: project.projectName,
        projectKind: (project.isDeleted
          ? 'deleted'
          : 'active') satisfies BillingUsageProjectKind,
      },
      timestamps,
      datapoints: project.totals,
    }));
}

import { DAY_MS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingUsageProjectKind,
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { compareBillingProjects } from '@/features/orgs/components/billing/BillingUsage/utils/compareBillingProjects';
import { startOfUtcDay } from '@/features/orgs/components/billing/BillingUsage/utils/startOfUtcDay';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

export default function toDailyBillingUsageSeries(
  reports: BillingUsageReport[],
  type: BillingUsageReportType,
  periodStart: string,
  periodEnd: string,
): MetricSeries[] {
  const periodStartMs = new Date(periodStart).getTime();
  const periodEndMs = new Date(periodEnd).getTime();
  const timestamps = enumerateUtcDays(periodStartMs, periodEndMs);
  const byProject = new Map<
    string,
    {
      projectName: string;
      isDeleted: boolean;
      dailyTotals: Map<number, number>;
    }
  >();

  reports.forEach((report) => {
    if (report.type !== type) {
      return;
    }
    const reportEnd = new Date(report.reportEnds).getTime();
    if (reportEnd < periodStartMs || reportEnd >= periodEndMs) {
      return;
    }
    const dayStart = startOfUtcDay(reportEnd);

    const current = byProject.get(report.projectID) ?? {
      projectName: report.projectName,
      isDeleted: report.isDeleted,
      dailyTotals: new Map<number, number>(),
    };
    current.dailyTotals.set(
      dayStart,
      (current.dailyTotals.get(dayStart) ?? 0) + report.value,
    );
    byProject.set(report.projectID, current);
  });

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
      timestamps: timestamps.map((timestamp) =>
        new Date(timestamp).toISOString(),
      ),
      datapoints: timestamps.map(
        (timestamp) => project.dailyTotals.get(timestamp) ?? 0,
      ),
    }));
}

function enumerateUtcDays(periodStart: number, periodEnd: number): number[] {
  const timestamps: number[] = [];
  for (
    let timestamp = startOfUtcDay(periodStart);
    timestamp < periodEnd;
    timestamp += DAY_MS
  ) {
    timestamps.push(timestamp);
  }
  return timestamps;
}

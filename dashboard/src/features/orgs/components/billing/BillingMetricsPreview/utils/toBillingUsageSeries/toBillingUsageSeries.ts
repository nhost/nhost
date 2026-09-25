import { DELETED_PROJECTS_GROUP_THRESHOLD } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import type {
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  formatDeletedProjectLabel,
  formatDeletedProjectsGroupLabel,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingProject';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DELETED_PROJECTS_GROUP_ID = 'deleted-projects';

export type BillingUsageProjectKind = 'active' | 'deleted' | 'deletedGroup';

export interface BillingUsagePeriod {
  periodStart: string;
  periodEnd: string;
  latestDay: number;
  latestReportEnd: string;
}

export interface BillingUsageSummary {
  total: number;
  topProject?: {
    projectID: string;
    name: string;
    isDeleted: boolean;
    total: number;
    percentage: number;
  };
  deletedProjects?: {
    count: number;
    total: number;
    percentage: number;
  };
}

export const BILLING_USAGE_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => `project-${labels.projectID}`,
  labelFor: (key, labels) => {
    switch (labels.projectKind) {
      case 'deleted':
        return formatDeletedProjectLabel(labels.projectID);
      case 'deletedGroup':
        return formatDeletedProjectsGroupLabel(
          deletedProjectIDsFor(labels).length,
        );
      default:
        return labels.projectName ?? key;
    }
  },
  colorFor: (_key, labels) => colorForProject(labels),
};

export function deletedProjectIDsFor(labels: Record<string, string>): string[] {
  switch (labels.projectKind) {
    case 'deleted':
      return [labels.projectID];
    case 'deletedGroup':
      return labels.deletedProjectIDs
        ? labels.deletedProjectIDs.split(',')
        : [];
    default:
      return [];
  }
}

export function getBillingUsagePeriod(
  reports: BillingUsageReport[],
  days: number,
): BillingUsagePeriod | undefined {
  const latestReportEnd = Math.max(
    ...reports
      .map((report) => new Date(report.reportEnds).getTime())
      .filter(Number.isFinite),
  );
  if (!Number.isFinite(latestReportEnd) || days <= 0) {
    return undefined;
  }

  const latestDay = startOfUtcDay(latestReportEnd);
  const periodEnd = latestDay + DAY_MS;
  const periodStart = periodEnd - days * DAY_MS;

  return {
    periodStart: new Date(periodStart).toISOString(),
    periodEnd: new Date(periodEnd).toISOString(),
    latestDay,
    latestReportEnd: new Date(latestReportEnd).toISOString(),
  };
}

export function toDailyBillingUsageSeries(
  reports: BillingUsageReport[],
  type: BillingUsageReportType,
  periodStart: string,
  periodEnd: string,
): MetricSeries[] {
  const periodStartMs = new Date(periodStart).getTime();
  const periodEndMs = new Date(periodEnd).getTime();
  if (
    !Number.isFinite(periodStartMs) ||
    !Number.isFinite(periodEndMs) ||
    periodEndMs <= periodStartMs
  ) {
    return [];
  }

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
    if (
      !Number.isFinite(reportEnd) ||
      reportEnd < periodStartMs ||
      reportEnd >= periodEndMs
    ) {
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
    .sort(
      ([projectIDA, projectA], [projectIDB, projectB]) =>
        Number(projectA.isDeleted) - Number(projectB.isDeleted) ||
        projectIDA.localeCompare(projectIDB),
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

// Folds deleted projects into a single series once there are more than
// `threshold` of them, so the legend stays readable. Daily series share one
// timeline, so the group is summed index by index.
export function groupDeletedProjectSeries(
  dailySeries: MetricSeries[],
  threshold: number = DELETED_PROJECTS_GROUP_THRESHOLD,
): MetricSeries[] {
  const deletedSeries = dailySeries.filter(
    (series) => series.labels.projectKind === 'deleted',
  );
  if (deletedSeries.length <= threshold) {
    return dailySeries;
  }

  const { timestamps } = deletedSeries[0];
  return [
    ...dailySeries.filter((series) => series.labels.projectKind !== 'deleted'),
    {
      labels: {
        projectID: DELETED_PROJECTS_GROUP_ID,
        projectName: 'Deleted projects',
        projectKind: 'deletedGroup' satisfies BillingUsageProjectKind,
        deletedProjectIDs: deletedSeries
          .map((series) => series.labels.projectID)
          .join(','),
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

export function toMonthlyCumulativeBillingUsageSeries(
  dailySeries: MetricSeries[],
): MetricSeries[] {
  return dailySeries.map((series) => {
    let month = '';
    let runningTotal = 0;
    const datapoints = series.datapoints.map((value, index) => {
      const timestamp = new Date(series.timestamps[index]);
      const nextMonth = `${timestamp.getUTCFullYear()}-${timestamp.getUTCMonth()}`;
      if (nextMonth !== month) {
        month = nextMonth;
        runningTotal = 0;
      }
      runningTotal += value;
      return runningTotal;
    });

    return { ...series, datapoints };
  });
}

export function sliceBillingUsageSeries(
  series: MetricSeries[],
  from: Date,
  to: Date,
): MetricSeries[] {
  const fromDay = startOfUtcDay(from.getTime());
  const toDay = startOfUtcDay(to.getTime());

  return series.map((item) => {
    const includedIndexes = item.timestamps
      .map((timestamp, index) => ({
        index,
        value: new Date(timestamp).getTime(),
      }))
      .filter(({ value }) => value >= fromDay && value <= toDay)
      .map(({ index }) => index);

    return {
      ...item,
      timestamps: includedIndexes.map((index) => item.timestamps[index]),
      datapoints: includedIndexes.map((index) => item.datapoints[index]),
    };
  });
}

// Expects per-project series (before `groupDeletedProjectSeries`), so the top
// project is always a single project rather than the deleted-projects group.
export function summarizeBillingUsageSeries(
  dailySeries: MetricSeries[],
): BillingUsageSummary {
  const projectTotals = dailySeries.map((series) => ({
    projectID: series.labels.projectID,
    name: series.labels.projectName ?? series.labels.projectID ?? 'Project',
    isDeleted: series.labels.projectKind === 'deleted',
    total: sumOf(series.datapoints),
  }));
  const total = sumOf(projectTotals.map((project) => project.total));
  if (total <= 0) {
    return { total };
  }

  const [topProject] = [...projectTotals].sort((a, b) => b.total - a.total);
  const deletedProjects = projectTotals.filter(
    (project) => project.isDeleted && project.total > 0,
  );
  const deletedTotal = sumOf(deletedProjects.map((project) => project.total));

  return {
    total,
    topProject: {
      ...topProject,
      percentage: toPercentage(topProject.total, total),
    },
    deletedProjects:
      deletedProjects.length > 0
        ? {
            count: deletedProjects.length,
            total: deletedTotal,
            percentage: toPercentage(deletedTotal, total),
          }
        : undefined,
  };
}

function sumOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function toPercentage(part: number, total: number): number {
  return Math.round((part / total) * 100);
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

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function colorForProject(labels: Record<string, string>): string {
  if (labels.projectKind === 'deletedGroup') {
    return 'hsl(var(--muted-foreground))';
  }
  const hue = hueForProjectID(labels.projectID);
  return labels.projectKind === 'deleted'
    ? `hsl(${hue} 20% 60%)`
    : `hsl(${hue} 65% 50%)`;
}

function hueForProjectID(projectID: string): number {
  let hash = 0;
  for (let index = 0; index < projectID.length; index += 1) {
    hash = (hash * 31 + projectID.charCodeAt(index)) % 360;
  }
  return hash;
}

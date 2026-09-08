import type {
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BillingUsagePeriod {
  periodStart: string;
  periodEnd: string;
  latestDay: number;
  latestReportEnd: string;
}

export interface BillingUsageSummary {
  total: number;
  topProject?: {
    name: string;
    total: number;
    percentage: number;
  };
}

export const BILLING_USAGE_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => `project-${labels.projectID}`,
  labelFor: (key, labels) => labels.projectName ?? key,
  colorFor: (_key, labels) => colorForProjectID(labels.projectID),
};

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
    { projectName: string; dailyTotals: Map<number, number> }
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
      dailyTotals: new Map<number, number>(),
    };
    current.dailyTotals.set(
      dayStart,
      (current.dailyTotals.get(dayStart) ?? 0) + report.value,
    );
    byProject.set(report.projectID, current);
  });

  return Array.from(byProject.entries())
    .sort(([projectIDA], [projectIDB]) => projectIDA.localeCompare(projectIDB))
    .map(([projectID, project]) => ({
      labels: {
        projectID,
        projectName: project.projectName,
      },
      timestamps: timestamps.map((timestamp) =>
        new Date(timestamp).toISOString(),
      ),
      datapoints: timestamps.map(
        (timestamp) => project.dailyTotals.get(timestamp) ?? 0,
      ),
    }));
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

export function summarizeBillingUsageSeries(
  dailySeries: MetricSeries[],
): BillingUsageSummary {
  const projectTotals = dailySeries.map((series) => ({
    name: series.labels.projectName ?? series.labels.projectID ?? 'Project',
    total: series.datapoints.reduce((sum, value) => sum + value, 0),
  }));
  const total = projectTotals.reduce((sum, project) => sum + project.total, 0);
  const topProject = projectTotals.sort((a, b) => b.total - a.total)[0];

  return {
    total,
    topProject:
      topProject && total > 0
        ? {
            ...topProject,
            percentage: Math.round((topProject.total / total) * 100),
          }
        : undefined,
  };
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

function colorForProjectID(projectID: string): string {
  let hash = 0;
  for (let index = 0; index < projectID.length; index += 1) {
    hash = (hash * 31 + projectID.charCodeAt(index)) % 360;
  }
  return `hsl(${hash} 65% 50%)`;
}

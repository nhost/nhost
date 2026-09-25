import { BILLING_USAGE_HISTORY_DAYS } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import {
  BILLING_USAGE_REPORT_TYPES,
  type BillingMetricsData,
  type BillingMetricsProject,
  type BillingTrackedResource,
  type BillingUsageReport,
  type BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';

export interface CreateMockBillingMetricsOptions {
  projects: BillingMetricsProject[];
  now: Date;
}

export function createMockBillingMetrics({
  projects,
  now,
}: CreateMockBillingMetricsOptions): Pick<
  BillingMetricsData,
  'usageReports' | 'trackedResources'
> {
  const rankedProjects = [...projects].sort((a, b) => a.id.localeCompare(b.id));

  return {
    usageReports: rankedProjects.flatMap((project, index) =>
      createUsageReports(project, index, now),
    ),
    trackedResources: rankedProjects.map((project, index) =>
      createTrackedResource(project, index),
    ),
  };
}

function createUsageReports(
  project: BillingMetricsProject,
  index: number,
  now: Date,
): BillingUsageReport[] {
  return Array.from({ length: BILLING_USAGE_HISTORY_DAYS }, (_value, day) => {
    const daysAgo = BILLING_USAGE_HISTORY_DAYS - day - 1;
    const reportEnds = addUtcDays(now, -daysAgo);

    return BILLING_USAGE_REPORT_TYPES.flatMap((type) => {
      const value = reportValue(type, index, day);
      if (value === 0) {
        return [];
      }

      return [
        {
          projectID: project.id,
          projectName: project.name,
          isDeleted: false,
          type,
          value,
          reportEnds: reportEnds.toISOString(),
        },
      ];
    });
  }).flat();
}

function reportValue(
  type: BillingUsageReportType,
  index: number,
  sample: number,
): number {
  switch (type) {
    case 'egress':
      return 1600 + index * 450 + (sample % 7) * 60;
    case 'functions':
      return 1800 + index * 300 + (sample % 5) * 120;
    case 'dedicatedCompute':
      return index % 2 === 0
        ? 240_000 + index * 60_000 + (sample % 6) * 15_000
        : 0;
    default: {
      const unsupportedType: never = type;
      return unsupportedType;
    }
  }
}

function createTrackedResource(
  project: BillingMetricsProject,
  index: number,
): BillingTrackedResource {
  return {
    projectID: project.id,
    projectName: project.name,
    isDeleted: false,
    dedicatedComputeMillicores: index % 2 === 0 ? 1000 + index * 500 : 0,
    functionsAmount: index + 1,
    customDomains: index % 2,
    persistentVolumeGB: 10 + index * 5,
    pitr: index % 3 === 0 ? 1 : 0,
  };
}

function addUtcHours(reference: Date, hours: number): Date {
  return new Date(reference.getTime() + hours * 60 * 60 * 1000);
}

function addUtcDays(reference: Date, days: number): Date {
  return addUtcHours(reference, days * 24);
}

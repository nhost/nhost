import type { ApolloError } from '@apollo/client';
import { useMemo, useState } from 'react';
import { BILLING_USAGE_HISTORY_DAYS } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import type {
  BillingCycle,
  BillingMetricsData,
  BillingTrackedResource,
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import {
  Billing_Report_Type_Enum,
  type GetBillingMetricsQuery,
  useGetBillingMetricsQuery,
} from '@/generated/graphql';

const DAY_MS = 24 * 60 * 60 * 1000;

const REPORT_TYPES: Record<Billing_Report_Type_Enum, BillingUsageReportType> = {
  [Billing_Report_Type_Enum.Egress]: 'egress',
  [Billing_Report_Type_Enum.Functions]: 'functions',
  [Billing_Report_Type_Enum.DedicatedCompute]: 'dedicatedCompute',
};

export interface UseBillingMetricsResult {
  data: BillingMetricsData | undefined;
  loading: boolean;
  error: ApolloError | undefined;
  refetch: VoidFunction;
}

export default function useBillingMetrics(): UseBillingMetricsResult {
  const { org } = useCurrentOrg();
  const isOrgAdmin = useIsOrgAdmin();
  const [now] = useState(() => new Date());

  const { data, loading, error, refetch } = useGetBillingMetricsQuery({
    variables: {
      organizationID: org?.id,
      from: new Date(
        now.getTime() - BILLING_USAGE_HISTORY_DAYS * DAY_MS,
      ).toISOString(),
    },
    skip: !org?.id || !isOrgAdmin,
    notifyOnNetworkStatusChange: true,
  });

  const currentCycle = useMemo(() => toUtcCalendarMonth(now), [now]);

  const apps = org?.apps;
  const metrics = useMemo<BillingMetricsData | undefined>(() => {
    if (!data) {
      return undefined;
    }

    const projectNames = new Map<string, string>(
      (apps ?? []).map((app) => [app.id, app.name]),
    );

    return {
      currentCycle,
      usageReports: toUsageReports(data, projectNames),
      trackedResources: toTrackedResources(data, projectNames),
    };
  }, [apps, currentCycle, data]);

  return { data: metrics, loading, error, refetch };
}

// Subscriptions are renewed on the 1st at 00:00 UTC and the chart buckets
// reports by UTC day, so the cycle follows the UTC calendar month rather than
// the browser's.
function toUtcCalendarMonth(now: Date): BillingCycle {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}

function toUsageReports(
  data: GetBillingMetricsQuery,
  projectNames: Map<string, string>,
): BillingUsageReport[] {
  return data.billingReports.map((report) => ({
    ...toBillingProject(report.appID, projectNames),
    type: REPORT_TYPES[report.type],
    value: report.value,
    reportEnds: report.reportEnds,
  }));
}

function toTrackedResources(
  data: GetBillingMetricsQuery,
  projectNames: Map<string, string>,
): BillingTrackedResource[] {
  const byProject = new Map<string, BillingTrackedResource>();

  const resourceFor = (appID: string): BillingTrackedResource => {
    const existing = byProject.get(appID);
    if (existing) {
      return existing;
    }
    const created: BillingTrackedResource = {
      ...toBillingProject(appID, projectNames),
      dedicatedComputeMillicores: 0,
      functionsAmount: 0,
      customDomains: 0,
      persistentVolumeGB: 0,
      pitr: 0,
    };
    byProject.set(appID, created);
    return created;
  };

  data.billingResources.forEach((row) => {
    const resource = resourceFor(row.appID);
    resource.functionsAmount = row.functionsAmount;
    resource.customDomains = row.customDomains;
    resource.persistentVolumeGB = row.persistentVolume;
    resource.pitr = row.pitr;
  });

  data.billingDedicatedComputes.forEach((row) => {
    const resource = resourceFor(row.appID);
    resource.dedicatedComputeMillicores = row.totalMillicores;
  });

  return Array.from(byProject.values()).sort(
    (a, b) =>
      Number(a.isDeleted) - Number(b.isDeleted) ||
      a.projectName.localeCompare(b.projectName),
  );
}

function toBillingProject(
  appID: string,
  projectNames: Map<string, string>,
): Pick<BillingUsageReport, 'projectID' | 'projectName' | 'isDeleted'> {
  const projectName = projectNames.get(appID);
  return {
    projectID: appID,
    projectName: projectName ?? appID,
    isDeleted: projectName === undefined,
  };
}

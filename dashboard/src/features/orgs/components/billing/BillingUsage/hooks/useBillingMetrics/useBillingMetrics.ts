import type { ApolloError } from '@apollo/client';
import { tz } from '@date-fns/tz';
import { addMonths, startOfMonth, subDays, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { BILLING_USAGE_HISTORY_DAYS } from '@/features/orgs/components/billing/BillingUsage/constants';
import type {
  BillingCycle,
  BillingMetricsData,
  BillingTrackedResource,
  BillingUsageReport,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { compareBillingProjects } from '@/features/orgs/components/billing/BillingUsage/utils/compareBillingProjects';
import { toBilledReports } from '@/features/orgs/components/billing/BillingUsage/utils/toBilledReports';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import {
  Billing_Report_Type_Enum,
  type GetBillingMetricsQuery,
  useBillingGetNextInvoiceQuery,
  useGetBillingMetricsQuery,
} from '@/generated/graphql';

const REPORT_TYPES: Record<Billing_Report_Type_Enum, BillingUsageReportType> = {
  [Billing_Report_Type_Enum.Egress]: 'egress',
  [Billing_Report_Type_Enum.Functions]: 'functions',
  [Billing_Report_Type_Enum.DedicatedCompute]: 'dedicatedCompute',
};

const MILLICORES_PER_VCPU = 1000;

const UTC = { in: tz('UTC') };

export interface UseBillingMetricsResult {
  data: BillingMetricsData | undefined;
  loading: boolean;
  error: ApolloError | undefined;
  refetch: VoidFunction;
  isNotOrgAdmin: boolean;
}

export default function useBillingMetrics(): UseBillingMetricsResult {
  const { org } = useCurrentOrg();
  const isNotOrgAdmin = !useIsOrgAdmin();
  const [now] = useState(() => new Date());

  const { data, loading, error, refetch } = useGetBillingMetricsQuery({
    variables: {
      organizationID: org.id,
      // A day more than the chart shows, so its first day, which starts at
      // midnight in the page's time zone, is complete.
      from: subDays(now, BILLING_USAGE_HISTORY_DAYS + 1).toISOString(),
    },
    skip: isNotOrgAdmin,
    notifyOnNetworkStatusChange: true,
  });

  const nextInvoice = useBillingGetNextInvoiceQuery({
    variables: { organizationID: org.id },
    skip: isNotOrgAdmin,
  });
  const periodEnd = nextInvoice.data?.billingGetNextInvoice?.PeriodEnd;
  const currentCycle = useMemo(
    () =>
      periodEnd ? toBillingCycleEndingAt(periodEnd) : toUtcCalendarMonth(now),
    [now, periodEnd],
  );

  const { apps } = org;
  const metrics = useMemo<BillingMetricsData | undefined>(() => {
    if (!data || nextInvoice.loading) {
      return undefined;
    }

    const projectNames = new Map<string, string>(
      apps.map((app) => [app.id, app.name]),
    );

    return {
      currentCycle,
      usageReports: toBilledReports(
        toUsageReports(data, projectNames),
        now.getTime(),
      ),
      trackedResources: toTrackedResources(data, projectNames),
    };
  }, [apps, currentCycle, data, nextInvoice.loading, now]);

  return { data: metrics, loading, error, refetch, isNotOrgAdmin };
}

function toBillingCycleEndingAt(periodEnd: string): BillingCycle {
  const end = new Date(periodEnd);
  return {
    start: new Date(subMonths(end, 1, UTC).getTime()).toISOString(),
    end: end.toISOString(),
  };
}

function toUtcCalendarMonth(now: Date): BillingCycle {
  const start = startOfMonth(now, UTC);
  return {
    start: new Date(start.getTime()).toISOString(),
    end: new Date(addMonths(start, 1, UTC).getTime()).toISOString(),
  };
}

function toUsageReports(
  data: GetBillingMetricsQuery,
  projectNames: Map<string, string>,
): BillingUsageReport[] {
  return data.billingReports.map((report) => ({
    ...toBillingProject(report.appID, projectNames),
    type: REPORT_TYPES[report.type],
    value:
      report.type === Billing_Report_Type_Enum.DedicatedCompute
        ? report.value / MILLICORES_PER_VCPU
        : report.value,
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

  data.billingTimeBasedUsages.forEach((row) => {
    const resource = resourceFor(row.appID);
    resource.dedicatedComputeMillicores = row.value;
  });

  return Array.from(byProject.values()).sort(compareBillingProjects);
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

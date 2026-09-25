import { HttpResponse } from 'msw';
import { createMockBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/createMockBillingMetrics';
import type {
  BillingMetricsProject,
  BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import { Billing_Report_Type_Enum } from '@/generated/graphql';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';

const REPORT_TYPE_VALUES: Record<
  BillingUsageReportType,
  Billing_Report_Type_Enum
> = {
  egress: Billing_Report_Type_Enum.Egress,
  functions: Billing_Report_Type_Enum.Functions,
  dedicatedCompute: Billing_Report_Type_Enum.DedicatedCompute,
};

export interface BillingMetricsQueryOptions {
  projects: BillingMetricsProject[];
  now: Date;
}

export function createBillingMetricsQueryData({
  projects,
  now,
}: BillingMetricsQueryOptions) {
  const metrics = createMockBillingMetrics({ projects, now });

  return {
    billingReports: metrics.usageReports.map((report) => ({
      appID: report.projectID,
      type: REPORT_TYPE_VALUES[report.type],
      value: report.value,
      reportEnds: report.reportEnds,
      __typename: 'billing_reports' as const,
    })),
    billingResources: metrics.trackedResources.map((resource) => ({
      appID: resource.projectID,
      functionsAmount: resource.functionsAmount,
      customDomains: resource.customDomains,
      persistentVolume: resource.persistentVolumeGB,
      pitr: resource.pitr,
      __typename: 'billing_resources' as const,
    })),
    billingDedicatedComputes: metrics.trackedResources
      .filter((resource) => resource.dedicatedComputeMillicores > 0)
      .map((resource) => ({
        appID: resource.projectID,
        totalMillicores: resource.dedicatedComputeMillicores,
        __typename: 'billing_dedicated_compute' as const,
      })),
  };
}

export function billingMetricsQuery(options: BillingMetricsQueryOptions) {
  const data = createBillingMetricsQueryData(options);

  return nhostGraphQLLink.query('getBillingMetrics', () =>
    HttpResponse.json({ data }),
  );
}

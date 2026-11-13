import { Spinner } from '@/components/ui/v3/spinner';
import { BillingUsageByProject } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageByProject';
import { BillingUsageEstimateNotice } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageEstimateNotice';
import { BillingUsageUnavailable } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageUnavailable';
import { CurrentTrackedResourcesTable } from '@/features/orgs/components/billing/BillingUsage/components/CurrentTrackedResourcesTable';
import { useBillingMetrics } from '@/features/orgs/components/billing/BillingUsage/hooks/useBillingMetrics';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function BillingUsage() {
  const { org } = useCurrentOrg();
  const { data, loading, error, refetch, isNotOrgAdmin } = useBillingMetrics();
  const hasProTeamPricing = !org.plan.name.startsWith('Enterprise');

  if (isNotOrgAdmin) {
    return (
      <BillingUsageUnavailable
        heading="Usage metrics are restricted"
        description="Organization administrator access is required to view usage metrics."
      />
    );
  }

  if (error) {
    return (
      <BillingUsageUnavailable
        heading="Usage metrics are unavailable"
        description="An error occurred while loading usage metrics. Please try again."
        onRetry={() => refetch()}
      />
    );
  }

  // `loading` is also true on every refetch, and we'd rather keep showing the
  // data we have than a spinner.
  if (!data) {
    return (
      <div className="flex justify-center rounded-md border bg-background p-12">
        <Spinner>Loading usage metrics...</Spinner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BillingUsageEstimateNotice />
      <BillingUsageByProject
        usageReports={data.usageReports}
        currentCycle={data.currentCycle}
        refreshing={loading}
        onRefresh={() => refetch()}
        showIncludedUsage={hasProTeamPricing}
      />
      <CurrentTrackedResourcesTable
        trackedResources={data.trackedResources}
        showPricing={hasProTeamPricing}
      />
    </div>
  );
}

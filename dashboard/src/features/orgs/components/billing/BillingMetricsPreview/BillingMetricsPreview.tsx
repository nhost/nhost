import { Spinner } from '@/components/ui/v3/spinner';
import { BillingAccessState } from '@/features/orgs/components/billing/BillingAccessState';
import BillingUsageChart from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingUsageChart';
import CurrentTrackedResourcesTable from '@/features/orgs/components/billing/BillingMetricsPreview/components/CurrentTrackedResourcesTable';
import { useBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/hooks/useBillingMetrics';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useUserData } from '@/hooks/useUserData';

export default function BillingMetricsPreview() {
  const { org } = useCurrentOrg();
  const user = useUserData();
  const isOrgAdmin = useIsOrgAdmin();
  const { data, loading, error, refetch } = useBillingMetrics();
  const isPermissionResolved = Boolean(org) && Boolean(user?.id);

  if (!isPermissionResolved) {
    return null;
  }

  if (!isOrgAdmin) {
    return (
      <BillingAccessState
        heading="Billing metrics are restricted"
        description="Organization administrator access is required to view billing metrics and usage."
      />
    );
  }

  if (error) {
    return (
      <BillingAccessState
        heading="Billing metrics are unavailable"
        description="An error occurred while loading billing metrics. Please try again."
        actionLabel="Try again"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center rounded-md border bg-background p-12">
        <Spinner aria-label="Loading billing metrics" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BillingUsageChart
        data={data}
        refreshing={loading}
        onRefresh={() => refetch()}
      />
      <CurrentTrackedResourcesTable data={data} />
    </div>
  );
}

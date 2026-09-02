import { BillingAccessState } from '@/features/orgs/components/billing/BillingAccessState';
import BillingMetricsCharts from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingMetricsCharts';
import CurrentTrackedResourcesTable from '@/features/orgs/components/billing/BillingMetricsPreview/components/CurrentTrackedResourcesTable';
import { useBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/hooks/useBillingMetrics';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useUserData } from '@/hooks/useUserData';

export default function BillingMetricsPreview() {
  const { org } = useCurrentOrg();
  const user = useUserData();
  const isOrgAdmin = useIsOrgAdmin();
  const { data, loading, refetch } = useBillingMetrics();
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

  return (
    <section
      aria-labelledby="billing-metrics-preview-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="billing-metrics-preview-heading"
          className="font-medium text-xl"
        >
          Billing metrics
        </h2>
      </div>

      <BillingMetricsCharts
        data={data}
        refreshing={loading}
        onRefresh={refetch}
      />
      <CurrentTrackedResourcesTable data={data} />
    </section>
  );
}

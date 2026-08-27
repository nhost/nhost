import BillingMetricsCharts from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingMetricsCharts';
import CurrentTrackedResourcesTable from '@/features/orgs/components/billing/BillingMetricsPreview/components/CurrentTrackedResourcesTable';
import { useBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/hooks/useBillingMetrics';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';

export default function BillingMetricsPreview() {
  const isOrgAdmin = useIsOrgAdmin();
  const { data, loading, refetch } = useBillingMetrics();

  if (!isOrgAdmin) {
    return null;
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

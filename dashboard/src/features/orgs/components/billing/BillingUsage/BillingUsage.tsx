import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import { BillingUsageByProject } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageByProject';
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
      <p className="text-muted-foreground text-sm">
        These figures are estimates. Your invoices show what you're billed. See{' '}
        <TextLink href="https://nhost.io/pricing" external>
          pricing
        </TextLink>{' '}
        and{' '}
        <TextLink
          href="https://docs.nhost.io/platform/cloud/billing#usage"
          external
        >
          how usage is billed
        </TextLink>
        .
      </p>
      <BillingUsageByProject
        data={data}
        refreshing={loading}
        onRefresh={() => refetch()}
        showIncludedUsage={hasProTeamPricing}
      />
      <CurrentTrackedResourcesTable
        data={data}
        showPricing={hasProTeamPricing}
      />
    </div>
  );
}

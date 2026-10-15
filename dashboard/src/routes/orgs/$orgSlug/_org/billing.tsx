import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { BillingEstimate } from '@/features/orgs/components/billing/BillingEstimate';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export const Route = createFileRoute('/orgs/$orgSlug/_org/billing')({
  component: OrgBilling,
});

function OrgBilling() {
  const { org, loading } = useCurrentOrg();
  const showBillingEstimate = !org?.plan?.isFree;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-full flex-col gap-4 bg-background p-4">
      <SubscriptionPlan />
      {showBillingEstimate && <BillingEstimate />}
    </div>
  );
}

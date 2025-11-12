import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { BillingEstimate } from '@/features/orgs/components/billing/BillingEstimate';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgBilling() {
  const { org, loading } = useCurrentOrg();
  const showBillingEstimate = !org?.plan?.isFree;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="bg-accent-background flex h-full flex-col gap-4 overflow-auto p-4">
      <SubscriptionPlan />
      {showBillingEstimate && <BillingEstimate />}
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout isOrgPage>{page}</OrgLayout>;
};

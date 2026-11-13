import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BillingEstimate } from '@/features/orgs/components/billing/BillingEstimate';
import { BillingArea } from '@/features/orgs/components/billing/layout';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function OrgBillingPlan() {
  const { org } = useCurrentOrg();

  return (
    <div className="flex flex-col gap-4 p-4">
      <SubscriptionPlan />
      {!org.plan.isFree && <BillingEstimate />}
    </div>
  );
}

OrgBillingPlan.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>
        <BillingArea>{page}</BillingArea>
      </OrganizationScope>
    </AppLayout>
  );
};

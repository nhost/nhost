import { BillingEstimate } from '@/features/orgs/components/billing/components/BillingEstimate';
import { SubscriptionPlan } from '@/features/orgs/components/billing/components/SubscriptionPlan';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgBilling() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-accent p-4">
      <SubscriptionPlan />
      {!isFree && <BillingEstimate />}
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

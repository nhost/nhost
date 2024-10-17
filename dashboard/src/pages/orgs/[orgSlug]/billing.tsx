import { SubscriptionPlan } from '@/features/orgs/components/billing/components/SubscriptionPlan';
import { Usage } from '@/features/orgs/components/billing/components/Usage';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgBilling() {
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto bg-muted/50">
      <SubscriptionPlan />
      <Usage />
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

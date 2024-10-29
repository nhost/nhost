import { OrgPagesContainer } from '@/components/layout/OrgPagesContainer';
import { SubscriptionPlan } from '@/features/orgs/components/billing/components/SubscriptionPlan';
import { Usage } from '@/features/orgs/components/billing/components/Usage';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgBilling() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto bg-accent">
      <SubscriptionPlan />
      {!isFree && <Usage />}
    </div>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'bg-accent',
      }}
    >
      <OrgPagesContainer>{page}</OrgPagesContainer>
    </ProjectLayout>
  );
};

import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { OrganizationScope } from '@/features/orgs/layout/OrganizationScope';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function OrgMembers() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-accent-background p-4">
      <MembersList />
      {!isFree && <PendingInvites />}
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>{page}</OrganizationScope>
    </AppLayout>
  );
};

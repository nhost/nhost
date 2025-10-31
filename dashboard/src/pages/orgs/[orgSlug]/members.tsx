import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgMembers() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="bg-accent-background flex h-full flex-col gap-4 overflow-auto p-4">
      <MembersList />
      {!isFree && <PendingInvites />}
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout isOrgPage>{page}</OrgLayout>;
};

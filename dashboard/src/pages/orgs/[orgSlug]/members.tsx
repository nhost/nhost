import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgMembers() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-accent p-4">
      <MembersList />
      {!isFree && <PendingInvites />}
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

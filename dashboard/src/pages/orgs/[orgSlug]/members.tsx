import { OrgPagesContainer } from '@/components/layout/OrgPagesContainer';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import type { ReactElement } from 'react';

export default function OrgMembers() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto bg-accent">
      <MembersList />
      {!isFree && <PendingInvites />}
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
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

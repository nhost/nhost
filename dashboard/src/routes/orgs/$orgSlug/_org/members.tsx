import { createFileRoute } from '@tanstack/react-router';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export const Route = createFileRoute('/orgs/$orgSlug/_org/members')({
  component: OrgMembers,
});

function OrgMembers() {
  const { org: { plan: { isFree } = {} } = {} } = useCurrentOrg();
  return (
    <div className="flex min-h-full flex-col gap-4 bg-background p-4">
      <MembersList />
      {!isFree && <PendingInvites />}
    </div>
  );
}

import { OrgMember } from '@/features/orgs/components/members/components/OrgMember';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function MembersList() {
  const { org } = useCurrentOrg();
  const members = org?.members ?? [];
  const isAdmin = useIsOrgAdmin();

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-md border bg-background">
      {/* Todo add an empty state here */}
      <div className="flex w-full flex-col divide-y">
        {members.map((member) => (
          <div
            key={member.id}
            className="px-4 py-3 transition-colors hover:bg-muted/60"
          >
            <OrgMember member={member} isAdmin={isAdmin} />
          </div>
        ))}
      </div>
    </div>
  );
}

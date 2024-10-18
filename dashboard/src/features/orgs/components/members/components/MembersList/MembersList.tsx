import { OrgMember } from '@/features/orgs/components/members/components/OrgMember';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function MembersList() {
  const { org } = useCurrentOrg();
  const members = org?.members ?? [];
  const isAdmin = useIsOrgAdmin();

  return (
    <div className="flex w-full flex-col rounded-md border bg-background">
      <div className="flex w-full flex-col gap-1 border-b p-4">
        <h4 className="font-medium">
          Members {members.length > 0 && `(${members.length})`}
        </h4>
        <p className="font-normal text-muted-foreground">
          People of this organization have the ability to manage all projects
          within the organization.
        </p>
      </div>

      {/* Todo add an empty state here */}
      <div className="flex w-full flex-col gap-4 p-4">
        {members.map((member) => (
          <OrgMember key={member.id} member={member} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}

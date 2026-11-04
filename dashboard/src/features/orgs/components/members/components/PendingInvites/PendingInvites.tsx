import { Inbox } from 'lucide-react';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgInvite } from '@/features/orgs/components/members/components/OrgInvite';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useGetOrganizationInvitesQuery } from '@/generated/graphql';

export default function PendingInvites() {
  const { org } = useCurrentOrg();
  const isAdmin = useIsOrgAdmin();

  const {
    data: { organizationMemberInvites = [] } = {},
    loading,
    error: getInvitesError,
  } = useGetOrganizationInvitesQuery({
    variables: { organizationId: org?.id },
    skip: !org,
  });

  if (getInvitesError) {
    throw getInvitesError;
  }

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-md border bg-background">
      {loading && (
        <div className="flex w-full items-center justify-center p-6">
          <Spinner size="xs" wrapperClassName="flex-row justify-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              Loading pending invites...
            </span>
          </Spinner>
        </div>
      )}

      {!loading && organizationMemberInvites.length > 0 && (
        <div className="flex w-full flex-col divide-y">
          {organizationMemberInvites.map((invite) => (
            <div
              key={invite.id}
              className="px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <OrgInvite invite={invite} isAdmin={isAdmin} />
            </div>
          ))}
        </div>
      )}

      {!loading && organizationMemberInvites.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
          <Inbox />
          <p className="text-sm">No pending invites</p>
        </div>
      )}
    </div>
  );
}

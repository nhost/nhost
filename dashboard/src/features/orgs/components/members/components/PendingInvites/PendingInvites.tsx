import { Inbox } from 'lucide-react';
import { OrgInvite } from '@/features/orgs/components/members/components/OrgInvite';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { Spinner } from '@/components/ui/v3/spinner';
import type { GetOrganizationInvitesQuery } from '@/generated/graphql';

type Invite = GetOrganizationInvitesQuery['organizationMemberInvites'][0];

export interface PendingInvitesProps {
  invites: Invite[];
  loading: boolean;
}

export default function PendingInvites({ invites, loading }: PendingInvitesProps) {
  const isAdmin = useIsOrgAdmin();

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

      {!loading && invites.length === 0 && (
        <div className="flex w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
          <Inbox />
          <p className="text-sm">No pending invites</p>
        </div>
      )}

      {!loading && invites.length > 0 && (
        <div className="flex w-full flex-col divide-y">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <OrgInvite invite={invite} isAdmin={isAdmin} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

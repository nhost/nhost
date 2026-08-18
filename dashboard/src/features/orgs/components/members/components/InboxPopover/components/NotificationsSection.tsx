import { Bell } from 'lucide-react';
import InviteNotification from '@/features/orgs/components/members/components/InboxPopover/components/InviteNotification';
import PendingOrganizationRequestNotification from '@/features/orgs/components/members/components/InboxPopover/components/PendingOrganizationRequestNotification';
import type {
  OrganizationMemberInvitesQuery,
  PostOrganizationRequestResponse,
} from '@/generated/graphql';

export interface NotificationsSectionProps {
  invites: OrganizationMemberInvitesQuery['organizationMemberInvites'];
  loading: boolean;
  pendingOrganizationRequest: PostOrganizationRequestResponse | null;
}

export default function NotificationsSection({
  invites,
  loading,
  pendingOrganizationRequest,
}: NotificationsSectionProps) {
  const isEmpty =
    !loading && invites.length === 0 && !pendingOrganizationRequest;

  return (
    <section className="flex flex-col gap-4 px-5 py-4">
      <h3 className="flex items-center gap-2 font-semibold text-muted-foreground text-xs tracking-widest">
        <Bell className="h-3 w-3" />
        NOTIFICATIONS
      </h3>

      {isEmpty && (
        <span className="text-muted-foreground text-xs">
          No new notifications
        </span>
      )}

      {pendingOrganizationRequest && (
        <PendingOrganizationRequestNotification
          request={pendingOrganizationRequest}
        />
      )}

      {invites.map((invite) => (
        <InviteNotification key={invite.id} invite={invite} />
      ))}
    </section>
  );
}

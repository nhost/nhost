import { Bell } from 'lucide-react';
import InviteNotification from '@/features/orgs/components/members/components/InboxPopover/components/InviteNotification';
import PendingOrganizationRequestNotification from '@/features/orgs/components/members/components/InboxPopover/components/PendingOrganizationRequestNotification';
import { usePendingOrganizationRequest } from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest';
import { useOrganizationMemberInvitesQuery } from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';

export default function NotificationsSection() {
  const userData = useUserData();
  const hasUserId = isNotEmptyValue(userData?.id);

  const { data, loading } = useOrganizationMemberInvitesQuery({
    variables: {
      userId: userData?.id ?? '',
    },
    skip: !hasUserId,
  });

  const invites = data?.organizationMemberInvites ?? [];
  const pendingOrganizationRequest = usePendingOrganizationRequest();

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

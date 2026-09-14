import AnnouncementsSection from '@/features/orgs/components/members/components/InboxPopover/AnnouncementsSection';
import NotificationsSection from '@/features/orgs/components/members/components/InboxPopover/NotificationsSection';
import type { InboxState } from '@/features/orgs/components/members/components/InboxPopover/useInbox';
import { cn } from '@/lib/utils';

export interface InboxBodyProps {
  inbox: InboxState;
  className?: string;
  onInviteAccepted: VoidFunction;
  onContinueCheckout: VoidFunction;
}

export default function InboxBody({
  inbox,
  className,
  onInviteAccepted,
  onContinueCheckout,
}: InboxBodyProps) {
  return (
    <div className={cn('overflow-y-auto', className)}>
      <NotificationsSection
        invites={inbox.invites}
        loading={inbox.invitesLoading}
        pendingOrganizationRequest={inbox.pendingOrganizationRequest}
        onInviteAccepted={onInviteAccepted}
        onContinueCheckout={onContinueCheckout}
      />

      <AnnouncementsSection
        announcements={inbox.announcements}
        loading={inbox.announcementsLoading}
      />
    </div>
  );
}

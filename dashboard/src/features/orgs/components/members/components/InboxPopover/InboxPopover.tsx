import { X } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverClose,
  PopoverContent,
} from '@/components/ui/v3/popover';
import { usePendingOrganizationRequest } from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest';
import {
  useGetAnnouncementsQuery,
  useOrganizationMemberInvitesQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import AnnouncementsSection from './components/AnnouncementsSection';
import NotificationsSection from './components/NotificationsSection';
import InboxPopoverTrigger from './InboxPopoverTrigger';

export interface InboxPopoverProps {
  className?: string;
}

export default function InboxPopover({ className }: InboxPopoverProps) {
  const userData = useUserData();
  const { isAuthenticated } = useAuth();
  const hasUserId = isNotEmptyValue(userData?.id);

  const { data: invitesData, loading: invitesLoading } =
    useOrganizationMemberInvitesQuery({
      variables: {
        userId: userData?.id ?? '',
      },
      skip: !hasUserId,
    });

  const { data: announcementsData, loading: announcementsLoading } =
    useGetAnnouncementsQuery({
      skip: !isAuthenticated,
    });

  const pendingOrganizationRequest = usePendingOrganizationRequest();
  const invites = invitesData?.organizationMemberInvites ?? [];
  const announcements = announcementsData?.announcements ?? [];
  const hasUnread =
    invites.length > 0 ||
    announcements.some((announcement) => announcement.read.length === 0) ||
    isNotEmptyValue(pendingOrganizationRequest);

  return (
    <Popover>
      <InboxPopoverTrigger className={className} hasUnread={hasUnread} />

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),32rem)] overflow-hidden p-0"
      >
        <div className="flex h-14 items-center justify-between border-b px-5">
          <h2 className="font-semibold text-lg">Inbox</h2>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Close inbox"
            >
              <X className="h-4 w-4" />
            </Button>
          </PopoverClose>
        </div>

        <div className="max-h-[min(calc(100vh-8rem),32rem)] overflow-y-auto">
          <NotificationsSection
            invites={invites}
            loading={invitesLoading}
            pendingOrganizationRequest={pendingOrganizationRequest}
          />

          <AnnouncementsSection
            announcements={announcements}
            loading={announcementsLoading}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

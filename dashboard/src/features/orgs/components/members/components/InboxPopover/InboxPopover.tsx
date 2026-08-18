import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Popover,
  PopoverClose,
  PopoverContent,
} from '@/components/ui/v3/popover';
import { usePendingOrganizationRequest } from '@/features/orgs/components/members/hooks/usePendingOrganizationRequest';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import {
  useGetAnnouncementsQuery,
  useOrganizationMemberInvitesQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import AnnouncementsSection from './AnnouncementsSection';
import InboxPopoverTrigger from './InboxPopoverTrigger';
import NotificationsSection from './NotificationsSection';

export interface InboxPopoverProps {
  className?: string;
}

export default function InboxPopover({ className }: InboxPopoverProps) {
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxTriggerRef = useRef<HTMLButtonElement>(null);
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
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setInboxOpen(false);
        }
      }}
    >
      <Popover open={inboxOpen} onOpenChange={setInboxOpen}>
        <InboxPopoverTrigger
          ref={inboxTriggerRef}
          className={className}
          hasUnread={hasUnread}
        />

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
              onInviteAccepted={() => setInboxOpen(false)}
            />

            <AnnouncementsSection
              announcements={announcements}
              loading={announcementsLoading}
            />
          </div>
        </PopoverContent>
      </Popover>

      {pendingOrganizationRequest && (
        <DialogContent
          className="bg-white text-black sm:max-w-xl"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            inboxTriggerRef.current?.focus();
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Create Organization Checkout Form</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          <StripeEmbeddedForm
            clientSecret={pendingOrganizationRequest.ClientSecret!}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

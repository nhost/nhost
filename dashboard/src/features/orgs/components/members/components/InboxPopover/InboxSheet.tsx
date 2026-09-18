import { X } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import InboxBody from '@/features/orgs/components/members/components/InboxPopover/InboxBody';
import InboxCheckoutDialog from '@/features/orgs/components/members/components/InboxPopover/InboxCheckoutDialog';
import type { InboxState } from '@/features/orgs/components/members/components/InboxPopover/useInbox';

export interface InboxSheetProps {
  inbox: InboxState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

export default function InboxSheet({
  inbox,
  open,
  onOpenChange,
  triggerRef,
}: InboxSheetProps) {
  return (
    <InboxCheckoutDialog
      pendingOrganizationRequest={inbox.pendingOrganizationRequest}
      triggerRef={triggerRef}
      onCheckoutOpen={() => onOpenChange(false)}
    >
      {(openCheckout) => (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            showOverlay
            hideCloseButton
            className="flex max-h-[85vh] flex-col gap-0 rounded-t-xl p-0"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-5">
              <SheetTitle className="text-lg">Inbox</SheetTitle>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Close inbox"
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">
              Notifications and announcements
            </SheetDescription>

            <InboxBody
              inbox={inbox}
              className="min-h-0 flex-1"
              onInviteAccepted={() => onOpenChange(false)}
              onContinueCheckout={openCheckout}
            />
          </SheetContent>
        </Sheet>
      )}
    </InboxCheckoutDialog>
  );
}

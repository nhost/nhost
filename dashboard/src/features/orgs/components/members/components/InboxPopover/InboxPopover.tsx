import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
} from '@/components/ui/v3/popover';
import InboxBody from '@/features/orgs/components/members/components/InboxPopover/InboxBody';
import {
  INBOX_POPOVER_ID,
  inboxAnchorRef,
  setInboxOpen,
  useInboxOpen,
} from '@/features/orgs/components/members/components/InboxPopover/inboxStore';
import type { InboxState } from '@/features/orgs/components/members/components/InboxPopover/useInbox';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';

export interface InboxPopoverProps {
  inbox: InboxState;
}

/**
 * Rendered once by `Header`, outside its layout switch, so an open checkout
 * survives crossing `md`. It attaches to whatever holds `inboxAnchorRef`.
 */
export default function InboxPopover({ inbox }: InboxPopoverProps) {
  const open = useInboxOpen();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Radix only restores focus to a `PopoverTrigger`, so this mirrors its rule:
  // focus goes back to the anchor unless the user dismissed by interacting
  // elsewhere.
  const dismissedOutsideRef = useRef(false);
  const { pendingOrganizationRequest } = inbox;

  // The open state lives in a module, so it would otherwise outlive the header
  // and reopen the inbox the next time it mounts.
  useEffect(() => () => setInboxOpen(false), []);

  function openCheckout() {
    setInboxOpen(false);
    setCheckoutOpen(true);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setInboxOpen}>
        <PopoverAnchor virtualRef={inboxAnchorRef} />

        <PopoverContent
          id={INBOX_POPOVER_ID}
          align="end"
          sideOffset={8}
          className="w-[min(calc(100vw-2rem),32rem)] overflow-hidden p-0"
          onInteractOutside={(event) => {
            // The anchor toggles the inbox itself; pressing it would otherwise
            // dismiss the inbox first and the click would reopen it.
            if (inboxAnchorRef.current?.contains(event.target as Node)) {
              event.preventDefault();
              return;
            }
            dismissedOutsideRef.current = true;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!dismissedOutsideRef.current) {
              inboxAnchorRef.current?.focus();
            }
            dismissedOutsideRef.current = false;
          }}
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

          <InboxBody
            inbox={inbox}
            className="max-h-[min(calc(100vh-8rem),32rem)]"
            onInviteAccepted={() => setInboxOpen(false)}
            onContinueCheckout={openCheckout}
          />
        </PopoverContent>
      </Popover>

      {pendingOrganizationRequest && (
        <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
          <DialogContent
            className="bg-white text-black sm:max-w-xl"
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              inboxAnchorRef.current?.focus();
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
        </Dialog>
      )}
    </>
  );
}

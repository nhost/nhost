import { type ReactNode, type RefObject, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import type { InboxState } from '@/features/orgs/components/members/components/InboxPopover/useInbox';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';

interface InboxCheckoutDialogProps {
  children: (openCheckout: VoidFunction) => ReactNode;
  pendingOrganizationRequest: InboxState['pendingOrganizationRequest'];
  triggerRef: RefObject<HTMLButtonElement | null>;
  onCheckoutOpen: VoidFunction;
}

export default function InboxCheckoutDialog({
  children,
  pendingOrganizationRequest,
  triggerRef,
  onCheckoutOpen,
}: InboxCheckoutDialogProps) {
  const [open, setOpen] = useState(false);

  function openCheckout() {
    onCheckoutOpen();
    setOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children(openCheckout)}
      {pendingOrganizationRequest && (
        <DialogContent
          className="bg-white text-black sm:max-w-xl"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
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

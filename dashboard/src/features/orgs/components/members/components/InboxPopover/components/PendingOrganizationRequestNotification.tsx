import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import NotificationCard from '@/features/orgs/components/members/components/InboxPopover/components/NotificationCard';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import type { PostOrganizationRequestResponse } from '@/generated/graphql';

export interface PendingOrganizationRequestNotificationProps {
  request: PostOrganizationRequestResponse;
}

export default function PendingOrganizationRequestNotification({
  request,
}: PendingOrganizationRequestNotificationProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <NotificationCard
        label="Pending organization request"
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Continue
          </Button>
        }
      >
        You have previously tried to upgrade or create a new organization
      </NotificationCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="bg-white text-black sm:max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Create Organization Checkout Form</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          <StripeEmbeddedForm clientSecret={request.ClientSecret!} />
        </DialogContent>
      </Dialog>
    </>
  );
}

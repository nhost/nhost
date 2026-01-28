import { useRouter } from 'next/router';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useDeleteEventTriggerMutation } from '@/features/orgs/projects/events/event-triggers/hooks/useDeleteEventTriggerMutation';
import { useGetEventTriggers } from '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggers';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isEmptyValue } from '@/lib/utils';

interface DeleteEventTriggerDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  eventTriggerToDelete: string;
}

export default function DeleteEventTriggerDialog({
  open,
  setOpen,
  eventTriggerToDelete,
}: DeleteEventTriggerDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, eventTriggerSlug } = router.query;
  const { mutateAsync: deleteEventTrigger, isPending: isDeletingEventTrigger } =
    useDeleteEventTriggerMutation();

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { data: eventTriggers } = useGetEventTriggers();

  const handleDeleteDialogClick = async () => {
    await execPromiseWithErrorToast(
      async () => {
        const originalEventTrigger = eventTriggers?.find(
          (et) => et.name === eventTriggerToDelete,
        );

        if (
          isEmptyValue(eventTriggerToDelete) ||
          isEmptyValue(originalEventTrigger)
        ) {
          throw new Error(
            'Error deleting event trigger, no event trigger to delete',
          );
        }

        await deleteEventTrigger({
          originalEventTrigger: originalEventTrigger!,
          resourceVersion,
        });
        if (eventTriggerSlug === eventTriggerToDelete) {
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/events/event-triggers`,
          );
        }
      },
      {
        loadingMessage: 'Deleting event trigger...',
        successMessage: 'Event trigger deleted successfully.',
        errorMessage: 'An error occurred while deleting the event trigger.',
      },
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingEventTrigger}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Event Trigger
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {eventTriggerToDelete}
            </span>{' '}
            event trigger?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingEventTrigger}
          >
            Delete
          </ButtonWithLoading>
          <DialogClose asChild>
            <Button variant="outline" className="!text-sm+ text-foreground">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

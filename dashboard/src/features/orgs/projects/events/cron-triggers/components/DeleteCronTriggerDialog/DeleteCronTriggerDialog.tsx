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
import { useDeleteCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useDeleteCronTriggerMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface DeleteCronTriggerDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  cronTriggerToDelete: string;
}

export default function DeleteCronTriggerDialog({
  open,
  setOpen,
  cronTriggerToDelete,
}: DeleteCronTriggerDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, cronTriggerSlug } = router.query;
  const { mutateAsync: deleteCronTrigger, isLoading: isDeletingCronTrigger } =
    useDeleteCronTriggerMutation();

  const handleDeleteDialogClick = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteCronTrigger({
          cronTriggerName: cronTriggerToDelete,
        });
        if (cronTriggerSlug === cronTriggerToDelete) {
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-triggers`,
          );
        }
      },
      {
        loadingMessage: 'Deleting cron trigger...',
        successMessage: 'Cron trigger deleted successfully.',
        errorMessage: 'An error occurred while deleting the cron trigger.',
      },
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingCronTrigger}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Cron Trigger
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {cronTriggerToDelete}
            </span>{' '}
            cron trigger?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingCronTrigger}
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

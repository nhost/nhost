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
import { useDeleteActionMutation } from '@/features/orgs/projects/actions/hooks/useDeleteActionMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface DeleteActionDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  actionToDelete: string;
}

export default function DeleteActionDialog({
  open,
  setOpen,
  actionToDelete,
}: DeleteActionDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, actionSlug } = router.query;
  const { mutateAsync: deleteAction, isPending: isDeletingAction } =
    useDeleteActionMutation();

  const handleDeleteDialogClick = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await deleteAction({
          actionName: actionToDelete,
        });
        if (actionSlug === actionToDelete) {
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions`,
          );
        }
      },
      {
        loadingMessage: 'Deleting action...',
        successMessage: 'Action deleted successfully.',
        errorMessage: 'An error occurred while deleting the action.',
      },
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingAction}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete Action</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {actionToDelete}
            </span>{' '}
            action?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingAction}
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

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
import { useDeleteActionMutation } from '@/features/orgs/projects/graphql/actions/hooks/useDeleteActionMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteActionDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  actionToDelete: ActionItem;
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
          action: actionToDelete,
        });
        if (actionSlug === actionToDelete.name) {
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
        className="p-12"
        hideCloseButton
        disableOutsideClick={isDeletingAction}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl">
            Delete Action
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {actionToDelete.name}
            </span>{' '}
            action?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-8">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <ButtonWithLoading
            variant="destructive"
            onClick={handleDeleteDialogClick}
            loading={isDeletingAction}
          >
            Delete
          </ButtonWithLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import useLogicalModelMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteLogicalModelDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  model: LogicalModelItem | null;
}

export default function DeleteLogicalModelDialog({
  open,
  setOpen,
  model,
}: DeleteLogicalModelDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, modelSlug } = router.query;
  const { mutateAsync: deleteLogicalModel, isPending: isDeletingLogicalModel } =
    useLogicalModelMetadataMutation({ type: 'delete' });

  const handleDeleteDialogClick = async () => {
    if (!model) {
      return;
    }
    await execPromiseWithErrorToast(
      async () => {
        await deleteLogicalModel({ original: model });
        if (modelSlug === model.name) {
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}`,
          );
        }
      },
      {
        loadingMessage: 'Deleting logical model...',
        successMessage: 'Logical model deleted successfully.',
        errorMessage: 'An error occurred while deleting the logical model.',
      },
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingLogicalModel}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Logical Model
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {model?.name}
            </span>{' '}
            logical model?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingLogicalModel}
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

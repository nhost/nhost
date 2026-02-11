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
import useDropInconsistentMetadataMutation from '@/features/orgs/projects/graphql/metadata/hooks/useDropInconsistentMetadataMutation/useDropInconsistentMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface DeleteInconsistentObjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteInconsistentObjectsDialog({
  open,
  onOpenChange,
}: DeleteInconsistentObjectsDialogProps) {
  const { isPending, mutateAsync: dropInconsistentMetadata } =
    useDropInconsistentMetadataMutation();

  const handleDeleteInconsistentObjects = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await dropInconsistentMetadata();
        onOpenChange(false);
      },
      {
        loadingMessage: 'Removing inconsistent metadata...',
        successMessage: 'Inconsistent metadata removed successfully.',
        errorMessage: 'Failed to remove inconsistent metadata.',
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isPending}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Remove Inconsistent Objects
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p className="text-pretty text-sm+">
              Permanently remove all inconsistent objects from your metadata.
            </p>
            <p className="text-pretty text-sm+">
              Affected databases, remote schemas, actions, and related features
              such as permissions, relationships, and event triggers tied to
              those objects will also be removed.
            </p>
            <p className="font-medium">This action is irreversible.</p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            loading={isPending}
            onClick={handleDeleteInconsistentObjects}
          >
            Remove
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

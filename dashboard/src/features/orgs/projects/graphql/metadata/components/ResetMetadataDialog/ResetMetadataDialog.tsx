import { Trash2 } from 'lucide-react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import useClearMetadataMutation from '@/features/orgs/projects/graphql/metadata/hooks/useClearMetadataMutation/useClearMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function ResetMetadataDialog() {
  const { isPending, mutateAsync: clearMetadata } = useClearMetadataMutation();

  const handleResetMetadata = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await clearMetadata();
      },
      {
        loadingMessage: 'Resetting metadata...',
        successMessage: 'Metadata reset successfully.',
        errorMessage: 'Failed to reset metadata.',
      },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reset Metadata
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isPending}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">Reset Metadata</DialogTitle>
          <DialogDescription>
            Permanently reset GraphQL engine's metadata and configure it from
            scratch (tracking relevant tables and relationships). This process
            is not reversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            loading={isPending}
            onClick={handleResetMetadata}
          >
            Reset Metadata
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

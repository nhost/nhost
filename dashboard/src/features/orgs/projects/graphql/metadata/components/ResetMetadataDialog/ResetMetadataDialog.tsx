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
import useClearMetadataMutation from '@/features/orgs/projects/graphql/metadata/hooks/useClearMetadataMutation/useClearMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface ResetMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ResetMetadataDialog({
  open,
  onOpenChange,
}: ResetMetadataDialogProps) {
  const { isPending, mutateAsync: clearMetadata } = useClearMetadataMutation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={async () => {
              await execPromiseWithErrorToast(
                async () => {
                  await clearMetadata();
                  onOpenChange(false);
                },
                {
                  loadingMessage: 'Resetting metadata...',
                  successMessage: 'Metadata reset successfully.',
                  errorMessage: 'Failed to reset metadata.',
                },
              );
            }}
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

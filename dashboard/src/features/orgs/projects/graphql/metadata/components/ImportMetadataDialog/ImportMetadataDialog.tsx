import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Label } from '@/components/ui/v3/label';
import useReplaceMetadataMutation from '@/features/orgs/projects/graphql/metadata/hooks/useReplaceMetadataMutation/useReplaceMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface ImportMetadataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metadata: Record<string, unknown> | null;
  onImportSuccess: () => void;
}

export default function ImportMetadataDialog({
  open,
  onOpenChange,
  metadata,
  onImportSuccess,
}: ImportMetadataDialogProps) {
  const [allowInconsistentMetadata, setAllowInconsistentMetadata] =
    useState(false);

  const { isPending, mutateAsync: replaceMetadata } =
    useReplaceMetadataMutation();

  const handleImportConfirm = async () => {
    if (!metadata) {
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await replaceMetadata({
          metadata,
          allowInconsistentMetadata,
        });
        onOpenChange(false);
        onImportSuccess();
      },
      {
        loadingMessage: 'Importing metadata...',
        successMessage: 'Metadata imported successfully.',
        errorMessage: 'Failed to import metadata.',
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
          <DialogTitle className="text-foreground">Import Metadata</DialogTitle>
          <DialogDescription>
            This will replace all current metadata with the imported file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="allow-inconsistent-metadata"
            checked={allowInconsistentMetadata}
            onCheckedChange={(checked) =>
              setAllowInconsistentMetadata(Boolean(checked))
            }
          />
          <Label
            htmlFor="allow-inconsistent-metadata"
            className="cursor-pointer font-normal text-foreground text-sm"
          >
            Allow inconsistent metadata
          </Label>
        </div>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            className="!text-sm+"
            loading={isPending}
            onClick={handleImportConfirm}
          >
            Import
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

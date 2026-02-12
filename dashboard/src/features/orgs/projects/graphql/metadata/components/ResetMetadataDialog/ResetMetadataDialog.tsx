import { Trash2 } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Label } from '@/components/ui/v3/label';
import { useClearMetadataMutation } from '@/features/orgs/projects/graphql/metadata/hooks/useClearMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function ResetMetadataDialog() {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { isPending, mutateAsync: clearMetadata } = useClearMetadataMutation();

  const handleResetMetadata = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await clearMetadata();
        setOpen(false);
        setConfirmed(false);
      },
      {
        loadingMessage: 'Resetting metadata...',
        successMessage: 'Metadata reset successfully.',
        errorMessage: 'Failed to reset metadata.',
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setConfirmed(false);
      }}
    >
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
        <div className="flex items-center space-x-2 py-2">
          <Checkbox
            id="confirm-reset"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(Boolean(checked))}
          />
          <Label
            htmlFor="confirm-reset"
            className="cursor-pointer font-medium text-foreground leading-none"
          >
            I'm sure I want to reset the metadata
          </Label>
        </div>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            loading={isPending}
            disabled={!confirmed}
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

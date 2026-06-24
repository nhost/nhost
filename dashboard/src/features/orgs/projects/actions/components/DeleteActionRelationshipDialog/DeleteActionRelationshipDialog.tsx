import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
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
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';

export interface DeleteActionRelationshipDialogProps {
  relationshipName: string;
  /**
   * Removes the relationship. Errors are surfaced by the caller, so the dialog
   * closes once the call settles.
   */
  onConfirm: () => Promise<void>;
}

export default function DeleteActionRelationshipDialog({
  relationshipName,
  onConfirm,
}: DeleteActionRelationshipDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid={`delete-action-rel-${relationshipName}`}
      >
        <Trash2Icon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[425px]"
          hideCloseButton
          disableOutsideClick={loading}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Relationship
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the{' '}
              <TextWithTooltip
                text={relationshipName}
                className="rounded-md bg-muted px-1 py-0.5 font-mono"
                containerClassName="inline-flex max-w-sm"
              />{' '}
              relationship?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
            <ButtonWithLoading
              variant="destructive"
              className="!text-sm+ text-white"
              onClick={handleConfirm}
              loading={loading}
              disabled={loading}
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
    </>
  );
}

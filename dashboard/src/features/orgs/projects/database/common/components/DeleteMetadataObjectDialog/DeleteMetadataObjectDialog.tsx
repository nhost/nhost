import type { ReactNode } from 'react';
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

interface DeleteMetadataObjectDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  noun: string;
  name: string | undefined;
  isPending: boolean;
  onConfirm: () => Promise<boolean>;
  warning?: ReactNode;
}

export default function DeleteMetadataObjectDialog({
  open,
  setOpen,
  title,
  noun,
  name,
  isPending,
  onConfirm,
  warning,
}: DeleteMetadataObjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isPending}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {name}
            </span>{' '}
            {noun}?
          </DialogDescription>
        </DialogHeader>
        {warning}
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={async () => {
              const succeeded = await onConfirm();
              if (succeeded) {
                setOpen(false);
              }
            }}
            loading={isPending}
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

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { buttonVariants } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Separator } from '@/components/ui/v3/separator';
import { Spinner } from '@/components/ui/v3/spinner';

interface DeleteBucketDialogProps {
  bucketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
}

export default function DeleteBucketDialog({
  bucketId,
  open,
  onOpenChange,
  onDelete,
}: DeleteBucketDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmed(false);
    }
    onOpenChange(nextOpen);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    setDeleting(true);

    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmed(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="flex w-[32rem] max-w-[32rem] flex-col gap-6 p-6 text-left text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle className="truncate">
            Delete Bucket
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block pb-4">
              Bucket:{' '}
              <span className="rounded-md bg-accent px-1 py-0.5 font-mono">
                {bucketId}
              </span>
            </span>
            <span className="block">
              Are you sure you want to delete this bucket?
            </span>
            <span className="block">
              <span className="font-bold text-destructive">
                All files will be permanently deleted.
              </span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Separator />
          <div className="flex items-center gap-3">
            <Checkbox
              id="delete-bucket-confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(Boolean(checked))}
            />
            <label
              htmlFor="delete-bucket-confirm"
              className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand this will permanently delete all files in this bucket
            </label>
          </div>
          <Separator />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className={buttonVariants({ variant: 'destructive' })}
            disabled={deleting || !confirmed}
          >
            {deleting ? <Spinner size="small" className="size-4" /> : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

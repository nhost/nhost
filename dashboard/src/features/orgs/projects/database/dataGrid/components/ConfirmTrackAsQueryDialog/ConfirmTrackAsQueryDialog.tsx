import { TriangleAlert } from 'lucide-react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';

export interface ConfirmTrackAsQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export default function ConfirmTrackAsQueryDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: ConfirmTrackAsQueryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Track as Query</DialogTitle>
          <DialogDescription>
            Are you sure you want to track this VOLATILE function as a query?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5 shrink-0 text-amber-500" />
            <p className="text-pretty text-muted-foreground text-sm">
              Queries should typically use STABLE or IMMUTABLE functions.
              Tracking a VOLATILE function as a query may cause unexpected
              behavior if the function has side effects.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="text-foreground"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            variant="secondary"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Track as Query
          </ButtonWithLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
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

        <Alert variant="warning">
          <TriangleAlert className="size-5" />
          <AlertDescription className="text-pretty text-muted-foreground">
            Queries should typically use STABLE or IMMUTABLE functions. Tracking
            a VOLATILE function as a query may cause unexpected behavior if the
            function has side effects.
          </AlertDescription>
        </Alert>

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

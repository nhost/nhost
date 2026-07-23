import { useEffect } from 'react';
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
import useLogicalModelMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteLogicalModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: LogicalModelItem | null;
  onDeleted?: VoidFunction;
}

export default function DeleteLogicalModelDialog({
  open,
  onOpenChange,
  model,
  onDeleted,
}: DeleteLogicalModelDialogProps) {
  const mutation = useLogicalModelMetadataMutation({ type: 'delete' });
  const resetMutation = mutation.reset;

  useEffect(() => {
    if (!open) {
      resetMutation();
    }
  }, [open, resetMutation]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete logical model?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes <strong>{model?.name}</strong>. Objects that reference
            it may prevent this operation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending || !model}
            onClick={async (event) => {
              event.preventDefault();
              if (!model) {
                return;
              }
              const result = await execPromiseWithErrorToast(
                () => mutation.mutateAsync({ original: model }),
                {
                  loadingMessage: 'Deleting logical model...',
                  successMessage: 'Logical model deleted.',
                  errorMessage: 'Could not delete the logical model.',
                },
              );
              if (result) {
                onOpenChange(false);
                onDeleted?.();
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

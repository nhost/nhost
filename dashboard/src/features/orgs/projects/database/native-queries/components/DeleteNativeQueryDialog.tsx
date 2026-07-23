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
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteNativeQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: NativeQueryItem | null;
  onDeleted?: VoidFunction;
}

export default function DeleteNativeQueryDialog({
  open,
  onOpenChange,
  query,
  onDeleted,
}: DeleteNativeQueryDialogProps) {
  const mutation = useNativeQueryMetadataMutation({ type: 'delete' });
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
          <AlertDialogTitle>Delete native query?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes <strong>{query?.root_field_name}</strong> from the
            GraphQL schema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending || !query}
            onClick={async (event) => {
              event.preventDefault();
              if (!query) {
                return;
              }
              const result = await execPromiseWithErrorToast(
                () => mutation.mutateAsync({ original: query }),
                {
                  loadingMessage: 'Deleting native query...',
                  successMessage: 'Native query deleted.',
                  errorMessage: 'Could not delete the native query.',
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

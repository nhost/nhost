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
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useDropRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDropRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useQueryClient } from '@tanstack/react-query';

interface DeleteRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Schema where the relationship is located.
   */
  schema: string;
  /**
   * Table to delete the relationship from.
   */
  tableName: string;
  relationshipToDelete: string;
  /**
   * Source where the relationship lives.
   *
   * @default 'default'
   */
  source?: string;
}

export default function DeleteRelationshipDialog({
  open,
  setOpen,
  schema,
  tableName,
  relationshipToDelete,
  source = 'default',
}: DeleteRelationshipDialogProps) {
  const { mutateAsync: deleteRelationship, isLoading: isDeletingRelationship } =
    useDropRelationshipMutation();

  const queryClient = useQueryClient();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleDeleteDialogClick = async () => {
    const promise = deleteRelationship({
      resourceVersion: resourceVersion!,
      args: {
        relationship: relationshipToDelete,
        table: {
          schema,
          name: tableName,
        },
        source,
      },
    });
    await execPromiseWithErrorToast(
      async () => {
        await promise;
      },
      {
        loadingMessage: 'Deleting relationship...',
        successMessage: 'Relationship deleted successfully.',
        errorMessage: 'An error occurred while deleting the relationship.',
      },
    );
    setOpen(false);
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['export-metadata'],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ['suggest-relationships', source],
      }),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-[425px]"
        hideCloseButton
        disableOutsideClick={isDeletingRelationship}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Delete Relationship
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the{' '}
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono">
              {relationshipToDelete}
            </span>{' '}
            relationship?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            variant="destructive"
            className="!text-sm+ text-white"
            onClick={handleDeleteDialogClick}
            loading={isDeletingRelationship}
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

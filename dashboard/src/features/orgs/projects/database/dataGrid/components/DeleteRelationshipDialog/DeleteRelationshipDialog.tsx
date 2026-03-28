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
import TextWithTooltip from '@/features/orgs/projects/common/components/TextWithTooltip/TextWithTooltip';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useDeleteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isEmptyValue } from '@/lib/utils';

interface DeleteRelationshipDialogProps {
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
  /**
   * Whether the relationship is a remote relationship.
   */
  isRemoteRelationship?: boolean;
}

export default function DeleteRelationshipDialog({
  schema,
  tableName,
  relationshipToDelete,
  source = 'default',
  isRemoteRelationship,
}: DeleteRelationshipDialogProps) {
  const [open, setOpen] = useState(false);

  const { mutateAsync: deleteRelationship } = useDeleteRelationshipMutation();

  const [loadingDelete, setLoadingDelete] = useState(false);

  const { data: resourceVersion, refetch: refetchResourceVersion } =
    useGetMetadataResourceVersion();

  const isDeleteDisabled = isEmptyValue(resourceVersion) || loadingDelete;

  const handleDeleteDialogClick = async () => {
    setLoadingDelete(true);
    const { data: latestResourceVersion } = await refetchResourceVersion();
    const type = isRemoteRelationship ? 'remote' : 'local';

    await execPromiseWithErrorToast(
      async () => {
        await deleteRelationship({
          resourceVersion: latestResourceVersion!,
          type,
          args: {
            relationshipName: relationshipToDelete,
            table: {
              schema,
              name: tableName,
            },
            source,
          },
        });
      },
      {
        loadingMessage: 'Deleting relationship...',
        successMessage: 'Relationship deleted successfully.',
        errorMessage: 'An error occurred while deleting the relationship.',
      },
    );
    setLoadingDelete(false);
    setOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        data-testid={`delete-rel-${relationshipToDelete}`}
      >
        <Trash2Icon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-[425px]"
          hideCloseButton
          disableOutsideClick={loadingDelete}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Relationship
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the{' '}
              <TextWithTooltip
                text={relationshipToDelete}
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
              onClick={handleDeleteDialogClick}
              loading={loadingDelete}
              disabled={isDeleteDisabled}
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

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
import { useDeleteRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteRemoteRelationshipMutation';
import { useDropRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDropRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas';
import { triggerToast } from '@/utils/toast';

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
  const {
    mutateAsync: deleteLocalRelationship,
    isLoading: isDeletingLocalRelationship,
  } = useDropRelationshipMutation();

  const {
    mutateAsync: deleteRemoteRelationship,
    isLoading: isDeletingRemoteRelationship,
  } = useDeleteRemoteRelationshipMutation();

  const isDeletingRelationship = isRemoteRelationship
    ? isDeletingRemoteRelationship
    : isDeletingLocalRelationship;

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const handleDeleteDialogClick = async () => {
    if (!resourceVersion) {
      triggerToast('Metadata is not ready yet. Please try again in a moment.');
      return;
    }

    let deleteRelationshipPromise: Promise<MetadataOperation200>;
    if (isRemoteRelationship) {
      deleteRelationshipPromise = deleteRemoteRelationship({
        resourceVersion: resourceVersion!,
        args: {
          name: relationshipToDelete,
          table: {
            schema,
            name: tableName,
          },
          source,
        },
      });
    } else {
      deleteRelationshipPromise = deleteLocalRelationship({
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
    }
    await execPromiseWithErrorToast(() => deleteRelationshipPromise, {
      loadingMessage: 'Deleting relationship...',
      successMessage: 'Relationship deleted successfully.',
      errorMessage: 'An error occurred while deleting the relationship.',
    });
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
          disableOutsideClick={isDeletingRelationship}
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
    </>
  );
}

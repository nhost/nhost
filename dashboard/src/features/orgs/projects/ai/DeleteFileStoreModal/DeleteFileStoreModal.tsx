import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import type { GraphiteFileStore } from '@/features/orgs/projects/ai/file-stores/types';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteFileStoreMutation } from '@/generated/graphite';

export interface DeleteFileStoreModalProps {
  fileStore: GraphiteFileStore;
  onDelete?: () => Promise<unknown>;
  close: () => void;
}

export default function DeleteFileStoreModal({
  fileStore,
  onDelete,
  close,
}: DeleteFileStoreModalProps) {
  const [remove, setRemove] = useState(false);
  const [loading, setLoading] = useState(false);

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [deleteFileStoreMutation] = useDeleteFileStoreMutation({
    client: remoteProjectGQLClient,
  });

  const deleteFileStore = async () => {
    await deleteFileStoreMutation({
      variables: {
        id: fileStore.id,
      },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoading(true);

    try {
      await execPromiseWithErrorToast(deleteFileStore, {
        loadingMessage: 'Deleting the file store...',
        successMessage: 'The file store has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the file store. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full rounded-lg p-6 text-left">
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-semibold text-lg">
          Delete File Store {fileStore.name}
        </h2>

        <p className="text-muted-foreground text-sm">
          Are you sure you want to delete this File Store?
        </p>

        <p className="font-bold text-destructive text-sm">
          This cannot be undone.
        </p>

        <div className="my-4">
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-delete-file-store"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete File Store"
            />
            <Label
              htmlFor="accept-delete-file-store"
              className="cursor-pointer font-normal"
            >
              {`I'm sure I want to delete ${fileStore.name}`}
            </Label>
          </div>
        </div>

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading
            variant="destructive"
            onClick={handleClick}
            disabled={!remove}
            loading={loading}
          >
            Delete File Store
          </ButtonWithLoading>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

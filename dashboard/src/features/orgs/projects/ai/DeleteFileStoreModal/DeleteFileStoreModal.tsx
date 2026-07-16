import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { GraphiteFileStore } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
import { useDeleteFileStoreMutation } from '@/utils/__generated__/graphite.graphql';

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

    await execPromiseWithErrorToast(deleteFileStore, {
      loadingMessage: 'Deleting the file store...',
      successMessage: 'The file store has been deleted successfully.',
      errorMessage:
        'An error occurred while deleting the file store. Please try again.',
    });
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      {' '}
      <div className="grid grid-flow-row gap-1">
        {' '}
        <Text variant="h3" component="h2">
          {' '}
          Delete File Store {fileStore?.name}{' '}
        </Text>{' '}
        <Text variant="subtitle2">
          {' '}
          Are you sure you want to delete this File Store?{' '}
        </Text>{' '}
        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
        </Text>
        <Box className="my-4">
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-1"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete File Store"
            />
            <Label htmlFor="accept-1" className="cursor-pointer font-normal">
              {`I'm sure I want to delete ${fileStore?.name}`}
            </Label>
          </div>
        </Box>
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
    </Box>
  );
}

import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { type GraphiteFileStore } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/file-stores';
import { useDeleteFileStoreMutation } from '@/utils/__generated__/graphite.graphql';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DeleteFileStoreModalProps {
  fileStore: GraphiteFileStore;
  onDelete?: () => Promise<any>;
  close: () => void;
}

export default function DeleteFileStoreModal({
  fileStore,
  onDelete,
  close,
}: DeleteFileStoreModalProps) {
  const [remove, setRemove] = useState(false);
  const [loading, setLoading] = useState(false);

  const { adminClient } = useAdminApolloClient();

  const [deleteFileStoreMutation] = useDeleteFileStoreMutation({
    client: adminClient,
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
          <Checkbox
            id="accept-1"
            label={`I'm sure I want to delete ${fileStore?.name}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete File Store"
          />
        </Box>
        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove}
            loading={loading}
          >
            Delete File Store
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

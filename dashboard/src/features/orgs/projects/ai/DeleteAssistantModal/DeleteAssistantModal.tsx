/* eslint-disable import/extensions */
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { type Assistant } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/assistants';
import { useDeleteAssistantMutation } from '@/utils/__generated__/graphite.graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface DeleteAssistantModalProps {
  assistant: Assistant;
  onDelete?: () => Promise<any>;
  close: () => void;
}

export default function DeleteAssistantModal({
  assistant,
  onDelete,
  close,
}: DeleteAssistantModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const { adminClient } = useAdminApolloClient();

  const [deleteAssistantMutation] = useDeleteAssistantMutation({
    client: adminClient,
  });

  const deleteAssistant = async () => {
    await deleteAssistantMutation({
      variables: {
        id: assistant.assistantID,
      },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(deleteAssistant, {
      loadingMessage: 'Deleting the assistant...',
      successMessage: 'The Assistant has been deleted successfully.',
      errorMessage:
        'An error occurred while deleting the Assistant. Please try again.',
    });
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Assistant {assistant?.name}
        </Text>

        <Text variant="subtitle2">
          Are you sure you want to delete this Assistant?
        </Text>

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
            label={`I'm sure I want to delete ${assistant?.name}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Assistant"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Assistant
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

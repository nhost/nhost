import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteAssistantMutation } from '@/generated/graphite';
import type { Assistant } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/assistants';

export interface DeleteAssistantModalProps {
  assistant: Assistant;
  onDelete?: () => Promise<unknown>;
  close: () => void;
}

export default function DeleteAssistantModal({
  assistant,
  onDelete,
  close,
}: DeleteAssistantModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [deleteAssistantMutation] = useDeleteAssistantMutation({
    client: remoteProjectGQLClient,
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
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-1"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete Assistant"
            />
            <Label htmlFor="accept-1" className="cursor-pointer font-normal">
              {`I'm sure I want to delete ${assistant?.name}`}
            </Label>
          </div>
        </Box>

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading
            variant="destructive"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Assistant
          </ButtonWithLoading>

          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

import { useState } from 'react';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import type { Assistant } from '@/features/orgs/projects/ai/assistants/types';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteAssistantMutation } from '@/generated/graphite';

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

    try {
      await execPromiseWithErrorToast(deleteAssistant, {
        loadingMessage: 'Deleting the assistant...',
        successMessage: 'The Assistant has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the Assistant. Please try again.',
      });
    } finally {
      setLoadingRemove(false);
    }
  }

  return (
    <div className="w-full rounded-lg p-6 text-left">
      <div className="grid grid-flow-row gap-1">
        <h2 className="font-semibold text-lg">
          Delete Assistant {assistant.name}
        </h2>

        <p className="text-muted-foreground text-sm">
          Are you sure you want to delete this Assistant?
        </p>

        <p className="font-bold text-destructive text-sm">
          This cannot be undone.
        </p>

        <div className="my-4">
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="accept-delete-assistant"
              checked={remove}
              onCheckedChange={(checked) => setRemove(checked === true)}
              aria-label="Confirm Delete Assistant"
            />
            <Label
              htmlFor="accept-delete-assistant"
              className="cursor-pointer font-normal"
            >
              {`I'm sure I want to delete ${assistant.name}`}
            </Label>
          </div>
        </div>

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
    </div>
  );
}

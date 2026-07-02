import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { Text } from '@/components/ui/v2/Text';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';
import { useDeleteAgentMutation } from '@/utils/__generated__/graphite.graphql';

export interface DeleteAgentModalProps {
  agent: Agent;
  onDelete?: () => Promise<unknown>;
  close: () => void;
}

export default function DeleteAgentModal({
  agent,
  onDelete,
  close,
}: DeleteAgentModalProps) {
  const [remove, setRemove] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  const { adminClient } = useAdminApolloClient();

  const [deleteAgentMutation] = useDeleteAgentMutation({
    client: adminClient,
  });

  const deleteAgent = async () => {
    await deleteAgentMutation({
      variables: {
        id: agent.id,
      },
    });
    await onDelete?.();
    close();
  };

  async function handleClick() {
    setLoadingRemove(true);

    await execPromiseWithErrorToast(deleteAgent, {
      loadingMessage: 'Deleting the agent...',
      successMessage: 'The Agent has been deleted successfully.',
      errorMessage:
        'An error occurred while deleting the Agent. Please try again.',
    });
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="h3" component="h2">
          Delete Agent {agent?.name}
        </Text>

        <Text variant="subtitle2">
          Are you sure you want to delete this Agent?
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
            label={`I'm sure I want to delete ${agent?.name}`}
            className="py-2"
            checked={remove}
            onChange={(_event, checked) => setRemove(checked)}
            aria-label="Confirm Delete Agent"
          />
        </Box>

        <div className="grid grid-flow-row gap-2">
          <Button
            color="error"
            onClick={handleClick}
            disabled={!remove}
            loading={loadingRemove}
          >
            Delete Agent
          </Button>

          <Button variant="outlined" color="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

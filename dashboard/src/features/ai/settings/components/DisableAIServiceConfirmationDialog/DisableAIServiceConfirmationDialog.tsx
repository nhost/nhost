import { useDialog } from '@/components/common/DialogProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useUpdateConfigMutation } from '@/utils/__generated__/graphql';
import type { ApolloError } from '@apollo/client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export interface DisableAIServiceConfirmationDialogProps {
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onCancel: () => void;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onServiceDisabled: () => void;
}

export default function DisableAIServiceConfirmationDialog({
  onCancel,
  onServiceDisabled,
}: DisableAIServiceConfirmationDialogProps) {
  const { closeDialog } = useDialog();
  const [loading, setLoading] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [updateConfig] = useUpdateConfigMutation();

  async function handleClick() {
    setLoading(true);

    await toast.promise(
      updateConfig({
        variables: {
          appId: currentProject.id,
          config: {
            ai: null,
          },
        },
      }),
      {
        loading: 'Disabling the AI service...',
        success: () => {
          onServiceDisabled();
          closeDialog();
          return `The service has been disabled.`;
        },
        error: (arg: ApolloError) => {
          // we need to get the internal error message from the GraphQL error
          const { internal } = arg.graphQLErrors[0]?.extensions || {};
          const { message } = (internal as Record<string, any>)?.error || {};

          // we use the default Apollo error message if we can't find the
          // internal error message
          return (
            message ||
            arg.message ||
            'An error occurred while disabling the AI service. Please try again later.'
          );
        },
      },
      getToastStyleProps(),
    );
  }

  return (
    <Box className={twMerge('w-full rounded-lg p-6 pt-0 text-left')}>
      <div className="grid grid-flow-row gap-1">
        <Text variant="subtitle2">
          Are you sure you want to disable this service?
        </Text>

        <Text
          variant="subtitle2"
          className="font-bold"
          sx={{ color: (theme) => `${theme.palette.error.main} !important` }}
        >
          This cannot be undone.
        </Text>

        <div className="grid grid-flow-row gap-2">
          <Button color="error" onClick={handleClick} loading={loading}>
            Disable
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              onCancel();
              closeDialog();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

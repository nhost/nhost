import { useDialog } from '@/components/common/DialogProvider';
import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useConfirmProvidersUpdatedMutation } from '@/utils/__generated__/graphql';
import { useTheme } from '@mui/material';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ProvidersUpdatedAlert() {
  const theme = useTheme();
  const { openAlertDialog } = useDialog();
  const [confirmed, setConfirmed] = useState(true);
  const { currentProject } = useCurrentWorkspaceAndProject();

  const [confirmProvidersUpdated] = useConfirmProvidersUpdatedMutation({
    variables: { id: currentProject?.id },
  });

  async function handleSubmitConfirmation() {
    const confirmProvidersUpdatedPromise = confirmProvidersUpdated();

    await toast.promise(
      confirmProvidersUpdatedPromise,
      {
        loading: 'Confirming...',
        success: 'Your settings have been updated successfully.',
        error: 'An error occurred while trying to confirm the message.',
      },
      getToastStyleProps(),
    );

    setConfirmed(false);
  }

  function handleOpenConfirmationDialog() {
    openAlertDialog({
      title: 'Confirm all providers updated?',
      payload: (
        <Text variant="subtitle1" component="span">
          Please make sure to update all providers before continuing. Your
          sign-in flows might break if you don&apos;t.
        </Text>
      ),
      props: {
        onPrimaryAction: handleSubmitConfirmation,
      },
    });
  }

  if (!confirmed) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      className="grid items-center grid-flow-row gap-2 p-4 place-items-center lg:grid-flow-col lg:place-content-between"
    >
      <div className="grid grid-flow-row gap-1 text-left">
        <Text className="font-semibold">
          Please update the Redirect URL for all providers being used
        </Text>

        <Text className="text-sm+">
          We are deprecating your project&apos;s old DNS name in favor of
          individual DNS names for each service. Please make sure to update your
          providers to use the new auth specific URL under <b>Redirect URL</b>{' '}
          before the 1st of February 2023.{' '}
          <Link
            href="https://github.com/nhost/nhost/discussions/1319"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className="font-medium"
          >
            Read the discussion here.
            <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
          </Link>
        </Text>
      </div>

      <Button
        variant="borderless"
        className={
          theme.palette.mode === 'dark'
            ? 'text-white hover:bg-brown'
            : 'text-black hover:bg-orange-300'
        }
        onClick={handleOpenConfirmationDialog}
      >
        I have updated all Redirect URLs
      </Button>
    </Alert>
  );
}

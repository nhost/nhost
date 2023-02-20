import { useDialog } from '@/components/common/DialogProvider';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useConfirmProvidersUpdatedMutation } from '@/utils/__generated__/graphql';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ProvidersUpdatedAlert() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openAlertDialog } = useDialog();
  const [confirmed, setConfirmed] = useState(true);

  const [confirmProvidersUpdated] = useConfirmProvidersUpdatedMutation({
    variables: { id: currentApplication?.id },
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
    <Alert className="grid items-center grid-flow-row gap-2 p-4 place-items-center lg:grid-flow-col lg:place-content-between bg-amber-500">
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

      <Button variant="borderless" onClick={handleOpenConfirmationDialog}>
        I have updated all Redirect URLs
      </Button>
    </Alert>
  );
}

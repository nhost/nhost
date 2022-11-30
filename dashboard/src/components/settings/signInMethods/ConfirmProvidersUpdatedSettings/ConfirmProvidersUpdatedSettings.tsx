import { useDialog } from '@/components/common/DialogProvider';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import { useState } from 'react';

export default function ConfirmProvidersUpdatedSettings() {
  const { openDialog } = useDialog();
  const [visible, setVisible] = useState(true);

  const removeElement = () => {
    setVisible((prev) => !prev);
  };

  function handleConfirmDialog() {
    openDialog('CONFIRM_PROVIDERS_UPDATED', {
      title: 'Confirm updated URLs for all providers?',
      payload: {
        onSubmit: () => removeElement(),
      },
    });
  }

  if (!visible) {
    return null;
  }

  return (
    <Alert className="grid grid-flow-col px-4 place-content-between bg-amber-500">
      <div className="grid grid-flow-row gap-1 text-left">
        <Text className="py-2 font-semibold">
          Please update the Redirect URL for all providers being used
        </Text>

        <Text className="text-sm">
          We are deprecating your project's old DNS name in favor of individual
          DNS names for each service. Please make sure to update your providers
          to use the new auth specific URL under <b>Redirect URL</b> before the
          1st of February 2023.{' '}
          <Link
            href={'https://docs.nhost.io/'}
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

      <Button variant="borderless" onClick={() => handleConfirmDialog()}>
        I have updated all Redirect URLs
      </Button>
    </Alert>
  );
}

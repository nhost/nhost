import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { NhostIcon } from '@/components/presentational/NhostIcon';
import { Alert } from '@/components/ui/v2/Alert';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { TransferOrUpgradeProjectDialog } from '@/features/orgs/components/common/TransferOrUpgradeProjectDialog';
import { useState } from 'react';

interface Props {
  description: string;
}

function UpgradeNotification({ description }: Props) {
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);

  const handleTransferDialogOpen = () => setTransferProjectDialogOpen(true);

  return (
    <Alert className="flex w-full flex-col justify-between gap-4 lg:flex-row">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col space-y-2 lg:flex-row lg:space-x-2 lg:space-y-0">
          <Text className="text-left">Available with</Text>
          <div className="flex flex-row space-x-2">
            <NhostIcon />
            <Text
              sx={{ color: 'primary.main' }}
              className="text-left font-semibold"
            >
              Nhost Pro & Team
            </Text>
          </div>
        </div>

        <Text component="span" className="max-w-[50ch] text-left">
          {description}
        </Text>
      </div>
      <Text className="flex flex-row items-center gap-4 self-end">
        <Link
          href="https://nhost.io/pricing"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          className="whitespace-nowrap text-center font-medium"
          sx={{
            color: 'text.secondary',
          }}
        >
          See all features
          <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
        </Link>
        <OpenTransferDialogButton onClick={handleTransferDialogOpen} />
        <TransferOrUpgradeProjectDialog
          open={transferProjectDialogOpen}
          setOpen={setTransferProjectDialogOpen}
        />
      </Text>
    </Alert>
  );
}

export default UpgradeNotification;

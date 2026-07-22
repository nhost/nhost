import { useState } from 'react';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { NhostIcon } from '@/components/presentational/NhostIcon';
import { Alert } from '@/components/ui/v3/alert';
import { TextLink } from '@/components/ui/v3/text-link';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';

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
          <p className="text-left">Available with</p>
          <div className="flex flex-row space-x-2">
            <NhostIcon />
            <p className="text-left font-semibold">Nhost Pro & Team</p>
          </div>
        </div>

        <p className="max-w-[50ch] text-left">{description}</p>
      </div>
      <div className="flex flex-row items-center gap-4 self-end">
        <TextLink
          href="https://nhost.io/pricing"
          external
          className="justify-center font-medium text-muted-foreground"
        >
          See all features
        </TextLink>
        <OpenTransferDialogButton onClick={handleTransferDialogOpen} />
      </div>
      <TransferProjectDialog
        open={transferProjectDialogOpen}
        setOpen={setTransferProjectDialogOpen}
      />
    </Alert>
  );
}

export default UpgradeNotification;

import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { TransferOrUpgradeProjectDialog } from '@/features/orgs/components/common/TransferOrUpgradeProjectDialog';
import { useCallback, useState } from 'react';

function UpgradeProjectDialog() {
  const [open, setOpen] = useState(false);

  const handleDialogOpen = useCallback(() => setOpen(true), []);
  return (
    <>
      <OpenTransferDialogButton
        buttonText="Upgrade project"
        onClick={handleDialogOpen}
      />
      <TransferOrUpgradeProjectDialog open={open} setOpen={setOpen} isUpgrade />
    </>
  );
}

export default UpgradeProjectDialog;

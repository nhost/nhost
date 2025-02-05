import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
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
      <TransferProjectDialog open={open} setOpen={setOpen} />
    </>
  );
}

export default UpgradeProjectDialog;

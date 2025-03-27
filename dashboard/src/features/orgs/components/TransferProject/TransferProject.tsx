import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { TransferOrUpgradeProjectDialog } from '@/features/orgs/components/common/TransferOrUpgradeProjectDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useState } from 'react';

export default function TransferProject() {
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsContainer
        title="Transfer Project"
        description="Move the current project to a different organization."
        submitButtonText="Transfer"
        slotProps={{
          submitButton: {
            type: 'button',
            color: 'primary',
            variant: 'contained',
            disabled: maintenanceActive || !isPlatform,
            onClick: () => setOpen(true),
          },
        }}
      />

      <TransferOrUpgradeProjectDialog open={open} setOpen={setOpen} />
    </>
  );
}

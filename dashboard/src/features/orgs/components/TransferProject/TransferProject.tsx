import { useState } from 'react';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function TransferProject() {
  const isPlatform = useIsPlatform();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsCard>
        <SettingsCardHeader
          title="Transfer Project"
          description="Move the current project to a different organization."
        />

        <SettingsCardFooter>
          <ButtonWithLoading
            type="button"
            disabled={!isPlatform}
            onClick={() => setOpen(true)}
            className="w-full sm:w-auto"
          >
            Transfer
          </ButtonWithLoading>
        </SettingsCardFooter>
      </SettingsCard>

      <TransferProjectDialog open={open} setOpen={setOpen} />
    </>
  );
}

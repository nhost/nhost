import { ArrowLeftRight } from 'lucide-react';
import { useState } from 'react';
import { SettingsRow } from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

export default function TransferProject() {
  const isPlatform = useIsPlatform();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow
        title="Transfer project"
        description="Move the current project to a different organization."
        action={
          <Button
            type="button"
            variant="outline"
            disabled={!isPlatform}
            onClick={() => setOpen(true)}
            className="w-full gap-2 sm:w-auto"
          >
            <ArrowLeftRight />
            Transfer
          </Button>
        }
      />

      <TransferProjectDialog open={open} setOpen={setOpen} />
    </>
  );
}

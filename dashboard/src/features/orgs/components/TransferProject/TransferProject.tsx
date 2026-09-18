import { ArrowRightLeft } from 'lucide-react';
import { useState } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

/**
 * A single availability row: title, description and the Transfer action.
 * Rendered inside the shared "Availability" card alongside Pause/Wake up,
 * not in its own card, so it stays visually grouped with them.
 */
export default function TransferProject() {
  const isPlatform = useIsPlatform();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <p className="font-medium">Transfer Project</p>
          <p className="text-muted-foreground text-sm">
            Move the current project to a different organization.
          </p>
        </div>

        <ButtonWithLoading
          type="button"
          variant="outline-emboss"
          disabled={!isPlatform}
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto"
        >
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Transfer
        </ButtonWithLoading>
      </div>

      <TransferProjectDialog open={open} setOpen={setOpen} />
    </>
  );
}

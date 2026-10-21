import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';

export default function ApplyLocalSettingsDialog() {
  const { closeDialog } = useDialog();

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <p className="text-muted-foreground text-sm">
        Run{' '}
        <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
          $ nhost up
        </code>{' '}
        using the cli to apply your changes
      </p>

      <Button className="w-full" onClick={() => closeDialog()}>
        OK
      </Button>
    </div>
  );
}

import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';

export default function ApplyLocalSettingsDialog() {
  const { closeDialog } = useDialog();

  return (
    <div className="flex flex-col gap-4 px-12 pb-12">
      <p className="text-muted-foreground text-sm">
        Run{' '}
        <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
          $ nhost up
        </code>{' '}
        using the cli to apply your changes
      </p>

      <Button className="mt-8 self-end" onClick={() => closeDialog()}>
        OK
      </Button>
    </div>
  );
}

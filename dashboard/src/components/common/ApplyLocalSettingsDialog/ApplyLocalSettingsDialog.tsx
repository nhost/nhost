import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';

export default function ApplyLocalSettingsDialog() {
  const { closeDialog } = useDialog();

  return (
    <div className="flex flex-col gap-4 px-6 pb-6">
      <div className="flex flex-col gap-2">
        <Text color="secondary">
          Run{' '}
          <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
            $ nhost up
          </code>{' '}
          using the cli to apply your changes
        </Text>
      </div>

      <Button
        className="w-full"
        color="primary"
        onClick={() => closeDialog()}
        autoFocus
      >
        OK
      </Button>
    </div>
  );
}

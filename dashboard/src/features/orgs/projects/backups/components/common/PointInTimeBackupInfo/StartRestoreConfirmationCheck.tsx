import { Checkbox } from '@/components/ui/v3/checkbox';
import { Separator } from '@/components/ui/v3/separator';
import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id: string;
}

function StartRestoreConfirmationCheck({
  id,
  label,
  checked,
  onCheckedChange,
}: Props) {
  return (
    <div>
      <div className="flex items-center space-x-2 pb-3">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
        <label
          htmlFor={id}
          className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      </div>
      <Separator />
    </div>
  );
}

export default StartRestoreConfirmationCheck;

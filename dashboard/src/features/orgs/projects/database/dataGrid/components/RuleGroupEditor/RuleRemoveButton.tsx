import { X } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import type {
  Rule,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface RuleRemoveButtonProps extends ButtonProps {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

function RuleRemoveButton({
  name,
  onRemove,
  className,
  disabled,
  ...props
}: RuleRemoveButtonProps) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  const unsupported: Record<string, any>[] = useWatch({
    name: `${name}.unsupported`,
  });

  return (
    <Button
      variant="outline"
      size="icon"
      className={twMerge('!min-w-0 h-10', className)}
      disabled={
        disabled ||
        (rules.length === 1 && !groups?.length && !unsupported?.length)
      }
      {...props}
      aria-label="Remove Rule"
      onClick={onRemove}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

export default RuleRemoveButton;

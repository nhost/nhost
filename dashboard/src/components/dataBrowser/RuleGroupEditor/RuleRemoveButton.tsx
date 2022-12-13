import type { Rule, RuleGroup } from '@/types/dataBrowser';
import type { ButtonProps } from '@/ui/v2/Button';
import Button from '@/ui/v2/Button';
import XIcon from '@/ui/v2/icons/XIcon';
import { useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

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
  ...props
}: RuleRemoveButtonProps) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });

  return (
    <Button
      variant="outlined"
      color="secondary"
      className={twMerge('!bg-white lg:!rounded-l-none', className)}
      disabled={rules.length === 1 && groups.length === 0}
      aria-label="Remove Rule"
      {...props}
      onClick={onRemove}
    >
      <XIcon />
    </Button>
  );
}

export default RuleRemoveButton;

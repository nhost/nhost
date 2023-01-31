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
  disabled,
  ...props
}: RuleRemoveButtonProps) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });
  const unsupported: Record<string, any>[] = useWatch({
    name: `${name}.unsupported`,
  });

  return (
    <Button
      variant="outlined"
      color="secondary"
      className={twMerge('lg:!rounded-l-none !min-w-0 h-10', className)}
      disabled={
        disabled ||
        (rules.length === 1 && !groups?.length && !unsupported?.length)
      }
      {...props}
      aria-label="Remove Rule"
      onClick={onRemove}
      sx={
        !disabled
          ? {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? `${theme.palette.grey[300]} !important`
                  : `${theme.palette.common.white} !important`,
            }
          : undefined
      }
    >
      <XIcon className="!w-4 !h-4" />
    </Button>
  );
}

export default RuleRemoveButton;

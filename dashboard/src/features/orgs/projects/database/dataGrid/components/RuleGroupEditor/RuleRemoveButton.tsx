import type { ButtonProps } from '@/components/ui/v2/Button';
import { Button } from '@/components/ui/v2/Button';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import type {
  Rule,
  RuleGroup,
} from '@/features/database/dataGrid/types/dataBrowser';
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
      className={twMerge('h-10 !min-w-0 lg:!rounded-l-none', className)}
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
      <XIcon className="!h-4 !w-4" />
    </Button>
  );
}

export default RuleRemoveButton;

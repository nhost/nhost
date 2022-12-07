import ControlledSelect from '@/components/common/ControlledSelect';
import type { Rule } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import XIcon from '@/ui/v2/icons/XIcon';
import Input from '@/ui/v2/Input';
import Option from '@/ui/v2/Option';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface RuleEditorRowProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Index of the rule.
   */
  index: number;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export default function RuleEditorRow({
  onRemove,
  index,
  className,
  ...props
}: RuleEditorRowProps) {
  const rules: Rule[] = useWatch({ name: 'rules' });

  return (
    <div className={twMerge('flex items-start flex-1', className)} {...props}>
      <Input
        className="flex-grow-1 flex-shrink-0 flex-[320px]"
        slotProps={{
          root: { className: '!rounded-r-none' },
          input: { className: '!bg-white' },
        }}
        fullWidth
      />

      <ControlledSelect
        name={`rules.${index}.operator`}
        className="flex-grow-1 flex-shrink-0 flex-[140px]"
        slotProps={{ root: { className: 'bg-white !rounded-none' } }}
        fullWidth
      >
        <Option value="_eq">_eq</Option>
        <Option value="_ne">_ne</Option>
        <Option value="_in">_in</Option>
        <Option value="_nin">_nin</Option>
        <Option value="_gt">_gt</Option>
        <Option value="_lt">_lt</Option>
        <Option value="_gte">_gte</Option>
        <Option value="_lte">_lte</Option>
        <Option value="_ceq">_ceq</Option>
        <Option value="_cne">_cne</Option>
        <Option value="_cgt">_cgt</Option>
        <Option value="_clt">_clt</Option>
        <Option value="_cgte">_cgte</Option>
        <Option value="_clte">_clte</Option>
        <Option value="_is_null">_is_null</Option>
      </ControlledSelect>

      <Input
        className="flex-auto"
        slotProps={{
          root: { className: '!rounded-none' },
          input: { className: '!bg-white' },
        }}
        fullWidth
      />

      <Button
        variant="outlined"
        color="secondary"
        className="!bg-white !rounded-l-none "
        disabled={rules.length === 1}
        aria-label="Remove rule"
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </div>
  );
}

import ControlledSelect from '@/components/common/ControlledSelect';
import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import XIcon from '@/ui/v2/icons/XIcon';
import Input from '@/ui/v2/Input';
import Option from '@/ui/v2/Option';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface RuleEditorRowProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Index of the rule.
   */
  index: number;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

function RemoveButton({
  name,
  onRemove,
}: Pick<RuleEditorRowProps, 'name' | 'onRemove'>) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });

  return (
    <Button
      variant="outlined"
      color="secondary"
      className="!bg-white lg:!rounded-l-none "
      disabled={rules.length === 1 && groups.length === 0}
      aria-label="Remove Rule"
      onClick={onRemove}
    >
      <XIcon />
    </Button>
  );
}

export default function RuleEditorRow({
  name,
  index,
  onRemove,
  className,
  ...props
}: RuleEditorRowProps) {
  const { register } = useFormContext();
  const ruleEditorRowName = `${name}.rules.${index}`;

  return (
    <div
      className={twMerge(
        'flex lg:flex-row flex-col items-stretch lg:max-h-10 flex-1 space-y-1 lg:space-y-0',
        className,
      )}
      {...props}
    >
      <Input
        {...register(`${ruleEditorRowName}.column`)}
        className="flex-grow-1 lg:flex-shrink-0 lg:flex-[320px] h-10"
        slotProps={{
          root: { className: 'lg:!rounded-r-none' },
          input: { className: '!bg-white' },
        }}
        fullWidth
        autoComplete="off"
      />

      <ControlledSelect
        name={`${ruleEditorRowName}.operator`}
        className="flex-grow-1 lg:flex-shrink-0 lg:flex-[140px] h-10"
        slotProps={{ root: { className: 'bg-white lg:!rounded-none' } }}
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
        {...register(`${ruleEditorRowName}.value`)}
        className="flex-auto"
        slotProps={{
          root: { className: 'lg:!rounded-none h-10' },
          input: { className: '!bg-white' },
        }}
        fullWidth
        autoComplete="off"
      />

      <RemoveButton onRemove={onRemove} name={name} />
    </div>
  );
}

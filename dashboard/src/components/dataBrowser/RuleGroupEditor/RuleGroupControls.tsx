import ControlledSelect from '@/components/common/ControlledSelect';
import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface RuleGroupControlsProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Name of the rule group to control.
   */
  name: string;
}

export default function RuleGroupControls({
  name,
  className,
  ...props
}: RuleGroupControlsProps) {
  const rules: Rule[] = useWatch({ name: `${name}.rules` });
  const groups: RuleGroup[] = useWatch({ name: `${name}.groups` });

  return (
    <div
      className={twMerge('grid grid-flow-row gap-2 content-start', className)}
      {...props}
    >
      {(rules.length > 1 || groups.length > 0) && (
        <ControlledSelect
          name={`${name}.operation`}
          slotProps={{ root: { className: 'bg-white' } }}
          fullWidth
        >
          <Option value="_and">and</Option>
          <Option value="_or">or</Option>
        </ControlledSelect>
      )}
    </div>
  );
}

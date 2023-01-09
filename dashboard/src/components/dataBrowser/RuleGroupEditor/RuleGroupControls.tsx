import ControlledSelect from '@/components/common/ControlledSelect';
import type { RuleGroup } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useWatch } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import useRuleGroupEditor from './useRuleGroupEditor';

export interface RuleGroupControlsProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Name of the rule group to control.
   */
  name: string;
  /**
   * Determines whether or not select should be shown or just a label with the
   * operator name.
   */
  showSelect?: boolean;
}

const operatorDictionary: Record<RuleGroup['operator'], string> = {
  _and: 'and',
  _or: 'or',
};

export default function RuleGroupControls({
  name,
  showSelect,
  className,
  ...props
}: RuleGroupControlsProps) {
  const { disabled } = useRuleGroupEditor();
  const currentOperator: RuleGroup['operator'] = useWatch({
    name: `${name}.operator`,
  });

  return (
    <div
      className={twMerge('grid grid-flow-row gap-2 content-start', className)}
      {...props}
    >
      {showSelect ? (
        <ControlledSelect
          disabled={disabled}
          name={`${name}.operator`}
          slotProps={{ root: { className: 'bg-white' } }}
          fullWidth
        >
          <Option value="_and">and</Option>
          <Option value="_or">or</Option>
        </ControlledSelect>
      ) : (
        <Text className="p-2 !font-medium">
          {operatorDictionary[currentOperator]}
        </Text>
      )}
    </div>
  );
}

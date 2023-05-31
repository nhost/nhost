import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import type { RuleGroup } from '@/features/database/dataGrid/types/dataBrowser';
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
      className={twMerge('grid grid-flow-row content-start gap-2', className)}
      {...props}
    >
      {showSelect ? (
        <ControlledSelect
          disabled={disabled}
          name={`${name}.operator`}
          slotProps={{
            root: {
              sx: {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? `${theme.palette.grey[300]} !important`
                    : `${theme.palette.common.white} !important`,
              },
            },
          }}
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

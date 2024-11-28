import { Text } from '@/components/ui/v2/Text';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type { RuleGroup } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
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
  const inputName = `${name}.operator`;
  const currentOperator: RuleGroup['operator'] = useWatch({
    name: inputName,
  });
  const { setValue } = useFormContext();

  return (
    <div
      className={twMerge('grid grid-flow-row content-start gap-2', className)}
      {...props}
    >
      {showSelect ? (
        <Select
          disabled={disabled}
          name={inputName}
          onValueChange={(newValue: string) => {
            setValue(inputName, newValue, { shouldDirty: true });
          }}
          defaultValue={currentOperator}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_and">and</SelectItem>
            <SelectItem value="_or">or</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Text className="p-2 !font-medium">
          {operatorDictionary[currentOperator]}
        </Text>
      )}
    </div>
  );
}

import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import RuleEditorRow from './RuleEditorRow';
import RuleGroupControls from './RuleGroupControls';

export interface RuleGroupEditorProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Name of the group editor.
   */
  name: string;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export default function RuleGroupEditor({
  onRemove,
  name,
  className,
  ...props
}: RuleGroupEditorProps) {
  const form = useFormContext();

  if (!form) {
    throw new Error('RuleGroupEditor must be used in a FormContext.');
  }

  const { control } = form;

  // Note: Reason for the type cast to `never`
  // https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
  const {
    fields: rules,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({
    control,
    name: `${name}.rules`,
  } as never);

  // Note: Reason for the type cast to `never`
  // https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
  const {
    fields: groups,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control,
    name: `${name}.groups`,
  } as never);

  return (
    <div
      className={twMerge('bg-gray-100 rounded-lg px-2', className)}
      {...props}
    >
      <div className="flex flex-col flex-auto space-y-2 py-4">
        {(rules as Rule[]).map((rule, ruleIndex) => (
          <div className="flex flex-row flex-auto" key={rule.id}>
            <div className="flex-[70px] flex-grow-0 flex-shrink-0 mr-2">
              {ruleIndex === 0 && (
                <Text className="p-2 !font-medium">Where</Text>
              )}

              {ruleIndex === 1 && <RuleGroupControls name={name} />}
            </div>

            <RuleEditorRow
              name={name}
              index={ruleIndex}
              onRemove={() => removeRule(ruleIndex)}
              className="flex-auto"
            />
          </div>
        ))}

        {(groups as RuleGroup[]).map((ruleGroup, ruleGroupIndex) => (
          <div className="flex flex-row flex-auto items-start mt-2">
            <div className="flex-[70px] flex-grow-0 flex-shrink-0 mr-2">
              {rules.length === 0 && ruleGroupIndex === 0 && (
                <Text className="p-2 !font-medium">Where</Text>
              )}

              {((rules.length === 0 && ruleGroupIndex === 1) ||
                (rules.length === 1 && ruleGroupIndex === 0)) && (
                <RuleGroupControls name={name} />
              )}
            </div>

            <RuleGroupEditor
              key={ruleGroup.id}
              onRemove={() => removeGroup(ruleGroupIndex)}
              name={`${name}.groups.${ruleGroupIndex}`}
              className="bg-gray-200 flex-auto"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-flow-col justify-between gap-2 pb-2">
        <div className="grid grid-flow-col gap-2 justify-start">
          <Button
            startIcon={<PlusIcon />}
            variant="borderless"
            onClick={() =>
              appendRule({ column: '', operator: '_eq', value: '' })
            }
          >
            New Rule
          </Button>

          <Button
            startIcon={<PlusIcon />}
            variant="borderless"
            onClick={() =>
              appendGroup({
                operation: '_and',
                rules: [{ column: '', operator: '_eq', value: '' }],
                groups: [],
              })
            }
          >
            New Group
          </Button>
        </div>

        {onRemove && (
          <Button
            startIcon={<TrashIcon />}
            variant="borderless"
            color="secondary"
            onClick={onRemove}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

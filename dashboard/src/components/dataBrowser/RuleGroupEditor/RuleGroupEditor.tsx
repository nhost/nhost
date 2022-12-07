import ControlledSelect from '@/components/common/ControlledSelect';
import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import { useFieldArray, useFormContext } from 'react-hook-form';
import RuleEditorRow from './RuleEditorRow';

export interface RuleGroupEditorProps {
  /**
   * Name of the group editor.
   */
  name: string;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export type RuleGroupEditorFormValues = RuleGroup;

export default function RuleGroupEditor({
  onRemove,
  name,
}: RuleGroupEditorProps) {
  const form = useFormContext<RuleGroupEditorFormValues>();

  if (!form) {
    throw new Error('RuleGroupEditor must be used in a FormContext.');
  }

  const { control } = form;

  // https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
  const {
    fields: rules,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({
    control,
    name: `${name}.rules`,
  } as never);

  const {
    fields: groups,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control,
    name: `${name}.groups`,
  } as never);

  console.log(rules);

  return (
    <div className="bg-gray-100 rounded-lg px-2">
      <div className="grid grid-flow-row gap-2 py-4">
        {(rules as Rule[]).map((rule, ruleIndex) => (
          <div className="flex flex-row gap-2 items-start" key={rule.id}>
            <div className="flex-[70px] flex-shrink-0 flex-grow-0">
              {ruleIndex === 0 && (
                <Text className="p-2 !font-medium">Where</Text>
              )}

              {ruleIndex === 1 && (
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

            <RuleEditorRow
              name={name}
              index={ruleIndex}
              onRemove={() => removeRule(ruleIndex)}
              className="flex-auto"
            />
          </div>
        ))}

        {(groups as RuleGroup[]).map((ruleGroup, ruleGroupIndex) => (
          <RuleGroupEditor
            key={ruleGroup.id}
            onRemove={() => removeGroup(ruleGroupIndex)}
            name={`${name}.groups.${ruleGroupIndex}`}
          />
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

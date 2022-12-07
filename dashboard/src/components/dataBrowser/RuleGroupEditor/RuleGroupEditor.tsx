import ControlledSelect from '@/components/common/ControlledSelect';
import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import Option from '@/ui/v2/Option';
import Text from '@/ui/v2/Text';
import { FormProvider, useFieldArray, useFormContext } from 'react-hook-form';
import RuleEditorRow from './RuleEditorRow';

export interface RuleGroupEditorProps {
  /**
   * Name of the group editor.
   */
  name: string;
  initialValue?: RuleGroup;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export type RuleGroupEditorFormValues = RuleGroup;

export default function RuleGroupEditor({ onRemove }: RuleGroupEditorProps) {
  const form = useFormContext<RuleGroupEditorFormValues>({});

  const { control } = form;

  // https://github.com/react-hook-form/react-hook-form/issues/4055#issuecomment-950145092
  const {
    fields: rules,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({
    control,
    name: 'rules',
  } as never);

  const {
    fields: groups,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control,
    name: 'groups',
  } as never);

  return (
    <FormProvider {...form}>
      <div className="bg-gray-100 rounded-lg px-2">
        <div className="grid grid-flow-row gap-2 py-4">
          {(rules as Rule[]).map((rule, ruleIndex) => (
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-1">
                {ruleIndex === 0 && (
                  <Text className="p-2 !font-medium">Where</Text>
                )}

                {ruleIndex === 1 && (
                  <ControlledSelect
                    name="operation"
                    slotProps={{ root: { className: 'bg-white' } }}
                    fullWidth
                  >
                    <Option value="_and">and</Option>
                    <Option value="_or">or</Option>
                  </ControlledSelect>
                )}
              </div>

              <RuleEditorRow
                key={rule.id}
                index={ruleIndex}
                onRemove={() => removeRule(ruleIndex)}
                className="col-span-11"
              />
            </div>
          ))}

          {(groups as RuleGroup[]).map((ruleGroup, ruleGroupIndex) => (
            <RuleGroupEditor
              key={ruleGroup.id}
              onRemove={() => removeGroup(ruleGroupIndex)}
              name="asd"
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
    </FormProvider>
  );
}

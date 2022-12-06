import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';
import RuleEditorRow from './RuleEditorRow';

export interface RuleGroupEditorProps {
  initialValue?: RuleGroup;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
}

export type RuleGroupEditorFormValues = RuleGroup;

export default function RuleGroupEditor({
  initialValue,
  onRemove,
}: RuleGroupEditorProps) {
  const form = useForm<RuleGroupEditorFormValues>({
    defaultValues: initialValue || {
      operation: '_and',
      rules: [{ column: '', operator: '_eq', value: '' }],
      groups: [],
    },
  });

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
            <RuleEditorRow
              key={rule.id}
              index={ruleIndex}
              onRemove={() => removeRule(ruleIndex)}
            />
          ))}

          {(groups as RuleGroup[]).map((ruleGroup, ruleGroupIndex) => (
            <RuleGroupEditor
              initialValue={ruleGroup}
              key={ruleGroup.id}
              index={ruleGroupIndex}
              onRemove={() => removeGroup(ruleGroupIndex)}
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

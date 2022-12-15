import type { Rule, RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import TrashIcon from '@/ui/v2/icons/TrashIcon';
import Text from '@/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import type { RuleEditorRowProps } from './RuleEditorRow';
import RuleEditorRow from './RuleEditorRow';
import RuleGroupControls from './RuleGroupControls';

export interface RuleGroupEditorProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement>,
    Pick<RuleEditorRowProps, 'disabledOperators'> {
  /**
   * Name of the group editor.
   */
  name: string;
  /**
   * Function to be called when the remove button is clicked.
   */
  onRemove?: VoidFunction;
  /**
   * Determines whether or not remove should be disabled for the rule group.
   */
  disableRemove?: boolean;
  /**
   * Group editor depth.
   *
   * @default 0
   */
  depth?: number;
}

export default function RuleGroupEditor({
  onRemove,
  name,
  className,
  disableRemove,
  disabledOperators = [],
  depth = 0,
  ...props
}: RuleGroupEditorProps) {
  const form = useFormContext();

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

  if (!form) {
    throw new Error('RuleGroupEditor must be used in a FormContext.');
  }

  return (
    <div
      className={twMerge(
        'rounded-lg px-2',
        depth === 0 && 'bg-greyscale-50',
        depth === 1 && 'bg-greyscale-100',
        depth === 2 && 'bg-greyscale-200',
        depth > 2 && 'bg-greyscale-300',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col flex-auto space-y-4 lg:space-y-2 py-4">
        {(rules as (Rule & { id: string })[]).map((rule, ruleIndex) => (
          <div className="flex flex-row flex-auto" key={rule.id}>
            <div className="flex-[70px] flex-grow-0 flex-shrink-0 mr-2">
              {ruleIndex === 0 && (
                <Text className="p-2 !font-medium">Where</Text>
              )}

              {ruleIndex > 0 && (
                <RuleGroupControls name={name} showSelect={ruleIndex === 1} />
              )}
            </div>

            <RuleEditorRow
              name={name}
              index={ruleIndex}
              onRemove={() => removeRule(ruleIndex)}
              className="flex-auto"
              disabledOperators={disabledOperators}
            />
          </div>
        ))}

        {(groups as (RuleGroup & { id: string })[]).map(
          (ruleGroup, ruleGroupIndex) => (
            <div
              className="flex flex-row flex-auto items-start mt-2"
              key={ruleGroup.id}
            >
              <div className="flex-[70px] flex-grow-0 flex-shrink-0 mr-2">
                {rules.length === 0 && ruleGroupIndex === 0 && (
                  <Text className="p-2 !font-medium">Where</Text>
                )}

                <RuleGroupControls
                  name={name}
                  showSelect={
                    (rules.length === 0 && ruleGroupIndex === 1) ||
                    (rules.length === 1 && ruleGroupIndex === 0)
                  }
                />
              </div>

              <RuleGroupEditor
                onRemove={() => removeGroup(ruleGroupIndex)}
                disableRemove={rules.length === 0 && groups.length === 1}
                disabledOperators={disabledOperators}
                name={`${name}.groups.${ruleGroupIndex}`}
                className="flex-auto"
                depth={depth + 1}
              />
            </div>
          ),
        )}
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
                operator: '_and',
                rules: [{ column: '', operator: '_eq', value: '' }],
                groups: [],
              })
            }
            disabled={depth > 2}
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
            disabled={disableRemove}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

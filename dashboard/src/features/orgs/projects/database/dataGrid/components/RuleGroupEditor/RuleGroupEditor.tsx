import { Alert } from '@/components/ui/v2/Alert';
import type { BoxProps } from '@/components/ui/v2/Box';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import type {
  Rule,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useMemo } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import RuleEditorRow from './RuleEditorRow';
import RuleGroupControls from './RuleGroupControls';
import { RuleGroupEditorContext } from './useRuleGroupEditor';

export interface RuleGroupEditorProps extends BoxProps {
  /**
   * Determines whether or not the rule group editor is disabled.
   */
  disabled?: boolean;
  /**
   * Schema for the column autocomplete.
   */
  schema: string;
  /**
   * Table for the column autocomplete.
   */
  table: string;
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
  /**
   * Maximum depth of the group editor.
   */
  maxDepth?: number;
}

export default function RuleGroupEditor({
  onRemove,
  name,
  className,
  disableRemove,
  depth = 0,
  maxDepth,
  schema,
  table,
  disabled,
  sx,
  ...props
}: RuleGroupEditorProps) {
  const { project } = useProject();
  const form = useFormContext();

  const { control, getValues } = form;
  const {
    fields: rules,
    append: appendRule,
    remove: removeRule,
  } = useFieldArray({
    control,
    name: `${name}.rules`,
  });

  const unsupportedValues: Record<string, any>[] =
    getValues(`${name}.unsupported`) || [];

  const {
    fields: groups,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({
    control,
    name: `${name}.groups`,
  });

  if (!form) {
    throw new Error('RuleGroupEditor must be used in a FormContext.');
  }

  const contextValue = useMemo(
    () => ({
      disabled,
      schema,
      table,
    }),
    [disabled, schema, table],
  );

  return (
    <RuleGroupEditorContext.Provider value={contextValue}>
      <Box
        {...props}
        className={twMerge(
          'flex min-h-44 flex-col justify-between rounded-lg border border-r-8 border-transparent pl-2',
          className,
        )}
        sx={[
          ...(Array.isArray(sx) ? sx : [sx]),
          depth === 0 && { backgroundColor: 'secondary.100' },
          depth === 1 && { backgroundColor: 'secondary.200' },
          depth === 2 && { backgroundColor: 'secondary.300' },
          depth === 3 && { backgroundColor: 'secondary.400' },
          depth === 4 && { backgroundColor: 'secondary.500' },
          depth === 5 && { backgroundColor: 'secondary.600' },
          depth === 6 && { backgroundColor: 'secondary.700' },
          depth > 6 && { backgroundColor: 'secondary.800' },
        ]}
      >
        <div className="grid grid-flow-row gap-4 py-4 lg:gap-2">
          {(rules as (Rule & { id: string })[]).map((rule, ruleIndex) => (
            <div className="grid grid-cols-[70px_1fr] gap-2" key={rule.id}>
              <div>
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
              />
            </div>
          ))}

          {(groups as (RuleGroup & { id: string })[]).map(
            (ruleGroup, ruleGroupIndex) => (
              <div
                className="grid grid-cols-[70px_1fr] gap-2"
                key={ruleGroup.id}
              >
                <div>
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
                  schema={schema}
                  table={table}
                  onRemove={() => removeGroup(ruleGroupIndex)}
                  disableRemove={rules.length === 0 && groups.length === 1}
                  name={`${name}.groups.${ruleGroupIndex}`}
                  depth={depth + 1}
                  disabled={disabled}
                />
              </div>
            ),
          )}

          {unsupportedValues?.length > 0 && (
            <Alert severity="warning" className="text-left">
              <Text>
                This rule group contains one or more objects (e.g: _exists) that
                are not supported by our dashboard yet.{' '}
                {project && (
                  <span>
                    Please{' '}
                    <Link
                      href={`${generateAppServiceUrl(
                        project.subdomain,
                        project.region,
                        'hasura',
                      )}/console/data/default/schema/${schema}/tables/${table}/permissions`}
                      underline="hover"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      visit Hasura
                    </Link>{' '}
                    to edit them.
                  </span>
                )}
              </Text>
            </Alert>
          )}
        </div>

        {!disabled && (
          <div className="grid grid-flow-row gap-2 pb-2 lg:grid-flow-col lg:justify-between">
            <div className="grid grid-flow-row gap-2 lg:grid-flow-col lg:justify-start">
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
                    unsupported: [],
                  })
                }
                disabled={depth >= maxDepth - 1}
              >
                New Group
              </Button>
            </div>

            {onRemove && (
              <Button
                variant="borderless"
                color="error"
                onClick={onRemove}
                disabled={disableRemove}
              >
                Delete Group
              </Button>
            )}
          </div>
        )}
      </Box>
    </RuleGroupEditorContext.Provider>
  );
}

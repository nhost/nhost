import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/v3/button';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2';
import { cn, isNotEmptyValue } from '@/lib/utils';
import ConditionRow from './ConditionRow';
import ExistsNodeRenderer from './ExistsNodeRenderer';
import OperatorBadge from './OperatorBadge';

const depthBackgrounds = [
  'bg-secondary-100',
  'bg-secondary-200',
  'bg-secondary-300',
  'bg-secondary-400',
  'bg-secondary-500',
  'bg-secondary-600',
  'bg-secondary-700',
] as const;

interface GroupNodeRendererProps {
  name: string;
  depth?: number;
  maxDepth?: number;
  onRemove?: VoidFunction;
  disableRemove?: boolean;
  allowExistsNodes?: boolean;
}

export default function GroupNodeRenderer({
  name,
  depth = 0,
  maxDepth,
  onRemove,
  disableRemove,
  allowExistsNodes = true,
}: GroupNodeRendererProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.children`,
  });

  const children: (RuleNode & { id: string })[] =
    useWatch({ name: `${name}.children` }) ?? [];

  const canAddGroup = isNotEmptyValue(maxDepth) ? depth < maxDepth - 1 : true;
  const canRemoveChild = fields.length > 1;

  function handleOnAddGroup() {
    append({
      type: 'group',
      id: uuidv4(),
      operator: '_and',
      children: [
        {
          type: 'condition',
          id: uuidv4(),
          column: '',
          operator: '_eq',
          value: null,
        },
      ],
    });
  }

  function onHandleAddRule() {
    append({
      type: 'condition',
      id: uuidv4(),
      column: '',
      operator: '_eq',
      value: null,
    });
  }

  function handleOnAddExists() {
    append({
      type: 'exists',
      id: uuidv4(),
      schema: '',
      table: '',
      where: {
        type: 'group',
        id: uuidv4(),
        operator: '_and',
        children: [
          {
            type: 'condition',
            id: uuidv4(),
            column: '',
            operator: '_eq',
            value: null,
          },
        ],
      },
    });
  }

  return (
    <div
      className={cn(
        'relative mt-4 rounded-lg border border-border p-3 pt-5',
        depthBackgrounds[Math.min(depth, depthBackgrounds.length - 1)],
      )}
    >
      <div className="absolute -top-3 left-3">
        <OperatorBadge name={name} depth={depth} />
      </div>

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const child = children[index];

          if (!child) {
            return null;
          }

          if (child.type === 'condition') {
            return (
              <ConditionRow
                key={field.id}
                name={`${name}.children.${index}`}
                onRemove={() => remove(index)}
                disableRemove={!canRemoveChild}
              />
            );
          }

          if (child.type === 'exists') {
            return (
              <ExistsNodeRenderer
                key={field.id}
                name={`${name}.children.${index}`}
                onRemove={() => remove(index)}
                disableRemove={!canRemoveChild}
                depth={depth + 1}
              />
            );
          }

          return (
            <GroupNodeRenderer
              key={field.id}
              name={`${name}.children.${index}`}
              depth={depth + 1}
              maxDepth={maxDepth}
              onRemove={() => remove(index)}
              disableRemove={!canRemoveChild}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={onHandleAddRule}
        >
          <Plus className="mr-1 h-4 w-4" />
          Rule
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          disabled={!canAddGroup}
          onClick={handleOnAddGroup}
        >
          <Plus className="mr-1 h-4 w-4" />
          Group
        </Button>

        {allowExistsNodes && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700"
            onClick={handleOnAddExists}
          >
            <Plus className="mr-1 h-4 w-4" />
            Exists
          </Button>
        )}

        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            disabled={disableRemove}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete Group
          </Button>
        )}
      </div>
    </div>
  );
}

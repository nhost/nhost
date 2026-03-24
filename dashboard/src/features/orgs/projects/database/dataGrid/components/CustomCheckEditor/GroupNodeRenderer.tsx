import { X } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';
import AddNodeButton from './AddNodeButton';
import ConditionRow from './ConditionRow';
import ExistsNodeRenderer from './ExistsNodeRenderer';
import LogicalOperatorBadge from './LogicalOperatorBadge';
import RelationshipNodeRenderer from './RelationshipNodeRenderer';
import useCustomCheckEditor from './useCustomCheckEditor';

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
}

export default function GroupNodeRenderer({
  name,
  depth = 0,
  maxDepth,
  onRemove,
}: GroupNodeRendererProps) {
  const { disabled: editorDisabled } = useCustomCheckEditor();
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.children`,
  });

  const children: (RuleNode & { id: string })[] =
    useWatch({ name: `${name}.children` }) ?? [];

  function handleAddNode(node: RuleNode) {
    append(node);
  }

  return (
    <div
      className={cn(
        'group-node relative mt-4 rounded-lg border border-border p-3 pt-5 transition-shadow [&:focus-within:not(:has(.group-node:focus-within))]:ring-2 [&:focus-within:not(:has(.group-node:focus-within))]:ring-ring/30 [&:hover:not(:has(.group-node:hover))]:ring-2 [&:hover:not(:has(.group-node:hover))]:ring-ring/50',
        depthBackgrounds[Math.min(depth, depthBackgrounds.length - 1)],
      )}
    >
      <div className="absolute -top-3 left-3">
        <LogicalOperatorBadge
          name={name}
          depth={depth}
          disabled={editorDisabled}
        />
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={editorDisabled}
          aria-label="Delete group"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      )}

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
              />
            );
          }

          if (child.type === 'exists') {
            return (
              <ExistsNodeRenderer
                key={field.id}
                name={`${name}.children.${index}`}
                onRemove={() => remove(index)}
                depth={depth + 1}
              />
            );
          }

          if (child.type === 'relationship') {
            return (
              <RelationshipNodeRenderer
                key={field.id}
                name={`${name}.children.${index}`}
                onRemove={() => remove(index)}
                depth={depth + 1}
                maxDepth={maxDepth}
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
            />
          );
        })}
      </div>

      <div className="mt-3">
        <AddNodeButton
          onSelect={handleAddNode}
          disabled={editorDisabled}
          fullWidth={fields.length === 0}
          label="Add"
        />
      </div>
    </div>
  );
}

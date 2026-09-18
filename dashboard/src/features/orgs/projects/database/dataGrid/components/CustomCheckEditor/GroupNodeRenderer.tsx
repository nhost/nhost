import { X } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import ConditionRow from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionRow';
import useCustomCheckEditor from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';

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
  const { control } = useFormContext();
  const { dialect } = useCustomCheckEditor();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.children`,
  });
  const {
    AddNode,
    ExistsNode,
    GroupOperator,
    RelationshipNode,
    UnsupportedNode,
  } = dialect;

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
        <GroupOperator name={name} depth={depth} />
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete group"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const child = children[index];
          const childName = `${name}.children.${index}`;
          const removeChild = () => remove(index);

          if (!child) {
            return null;
          }

          if (child.type === 'condition') {
            return (
              <ConditionRow
                key={field.id}
                name={childName}
                onRemove={removeChild}
              />
            );
          }

          if (child.type === 'exists') {
            return (
              <ExistsNode
                key={field.id}
                name={childName}
                onRemove={removeChild}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            );
          }

          if (child.type === 'invalid') {
            return (
              <UnsupportedNode
                key={field.id}
                name={childName}
                onRemove={removeChild}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            );
          }

          if (child.type === 'relationship') {
            return (
              <RelationshipNode
                key={field.id}
                name={childName}
                onRemove={removeChild}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            );
          }

          return (
            <GroupNodeRenderer
              key={field.id}
              name={childName}
              depth={depth + 1}
              maxDepth={maxDepth}
              onRemove={removeChild}
            />
          );
        })}
      </div>

      <div className="mt-3">
        <AddNode
          onSelect={handleAddNode}
          fullWidth={fields.length === 0}
          label="Add"
        />
      </div>
    </div>
  );
}

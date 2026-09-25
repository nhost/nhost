import { Trash2, X } from 'lucide-react';
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import ExistsNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ExistsNodeRenderer';
import InvalidNodeRenderer from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/InvalidNodeRenderer';
import LogicalOperatorBadge from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/LogicalOperatorBadge';
import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';
import LogicalModelAddNodeButton from './LogicalModelAddNodeButton';
import LogicalModelConditionRow from './LogicalModelConditionRow';

const depthBackgrounds = [
  'bg-secondary-100',
  'bg-secondary-200',
  'bg-secondary-300',
  'bg-secondary-400',
  'bg-secondary-500',
  'bg-secondary-600',
  'bg-secondary-700',
] as const;

interface LogicalModelGroupNodeRendererProps {
  name: string;
  depth?: number;
  onRemove?: VoidFunction;
}

function LogicalModelInvalidNode({
  name,
  onRemove,
}: {
  name: string;
  onRemove: VoidFunction;
}) {
  const { control, getFieldState } = useFormContext();
  const formState = useFormState({ control, name });
  const { error } = getFieldState(name, formState);

  return (
    <div>
      <InvalidNodeRenderer name={name} onRemove={onRemove} />
      {error?.message ? (
        <p className="mt-1 text-destructive text-sm">{error.message}</p>
      ) : null}
    </div>
  );
}

export default function LogicalModelGroupNodeRenderer({
  name,
  depth = 0,
  onRemove,
}: LogicalModelGroupNodeRendererProps) {
  const { control, getFieldState } = useFormContext();
  const formState = useFormState({ control, name });
  const {
    fields: fieldArrayItems,
    append,
    remove,
  } = useFieldArray({
    control,
    name: `${name}.children`,
  });
  const group = useWatch({ name }) as GroupNode | undefined;
  const children: RuleNode[] = group?.children ?? [];
  const { error: childrenError } = getFieldState(`${name}.children`, formState);
  const errorMessage = childrenError?.root?.message ?? childrenError?.message;

  return (
    <div
      className={cn(
        'group-node relative mt-4 rounded-lg border border-border p-3 pt-5 transition-shadow [&:focus-within:not(:has(.group-node:focus-within))]:ring-2 [&:focus-within:not(:has(.group-node:focus-within))]:ring-ring/30 [&:hover:not(:has(.group-node:hover))]:ring-2 [&:hover:not(:has(.group-node:hover))]:ring-ring/50',
        depthBackgrounds[Math.min(depth, depthBackgrounds.length - 1)],
      )}
    >
      <div className="absolute -top-3 left-3">
        <LogicalOperatorBadge name={name} depth={depth} />
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete group"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="flex flex-col gap-2">
        {fieldArrayItems.map((field, index) => {
          const child = children[index];
          const childName = `${name}.children.${index}`;
          if (!child) {
            return null;
          }

          if (child.type === 'condition') {
            return (
              <LogicalModelConditionRow
                key={field.id}
                name={childName}
                onRemove={() => remove(index)}
              />
            );
          }

          if (child.type === 'exists') {
            return (
              <ExistsNodeRenderer
                key={field.id}
                name={childName}
                onRemove={() => remove(index)}
                depth={depth + 1}
              />
            );
          }

          if (child.type === 'invalid') {
            return (
              <LogicalModelInvalidNode
                key={field.id}
                name={childName}
                onRemove={() => remove(index)}
              />
            );
          }

          if (child.type === 'relationship') {
            return (
              <div
                key={field.id}
                className="mt-4 flex items-center gap-2 rounded-md border border-destructive/60 bg-destructive/5 px-3 py-2 text-destructive text-sm"
              >
                <span className="flex-1">
                  {child.relationship}: Nested fields aren't supported in
                  logical model permissions
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => remove(index)}
                  aria-label="Delete nested field"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          }

          return (
            <LogicalModelGroupNodeRenderer
              key={field.id}
              name={childName}
              depth={depth + 1}
              onRemove={() => remove(index)}
            />
          );
        })}
      </div>

      {errorMessage ? (
        <p className="mt-2 text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-3">
        <LogicalModelAddNodeButton
          onSelectNode={append}
          fullWidth={fieldArrayItems.length === 0}
          label="Add"
        />
      </div>
    </div>
  );
}

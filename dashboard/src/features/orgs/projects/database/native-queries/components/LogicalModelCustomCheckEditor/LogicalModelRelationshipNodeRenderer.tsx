import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { RelationshipNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import LogicalModelGroupNodeRenderer from './LogicalModelGroupNodeRenderer';
import useLogicalModelCustomCheckEditor, {
  LogicalModelCustomCheckEditorContext,
} from './useLogicalModelCustomCheckEditor';

interface LogicalModelRelationshipNodeRendererProps {
  name: string;
  depth?: number;
  onRemove?: VoidFunction;
}

export default function LogicalModelRelationshipNodeRenderer({
  name,
  depth = 0,
  onRemove,
}: LogicalModelRelationshipNodeRendererProps) {
  const { control, getFieldState } = useFormContext();
  const { fields, pathPrefix } = useLogicalModelCustomCheckEditor();
  const formState = useFormState({ control, name });
  const node = useWatch({ name }) as RelationshipNode | undefined;
  const relationship = node?.relationship ?? '';
  const contextValue = useMemo(
    () => ({
      fields,
      pathPrefix: [...pathPrefix, ...relationship.split('.').filter(Boolean)],
    }),
    [fields, pathPrefix, relationship],
  );
  const { error: relationshipError } = getFieldState(
    `${name}.relationship`,
    formState,
  );
  const { error: childError } = getFieldState(`${name}.child`, formState);
  const { error: nodeError } = getFieldState(name, formState);

  return (
    <div className="group-node relative mt-4 rounded-lg border border-border bg-secondary-100 p-3 pt-5 transition-shadow [&:focus-within:not(:has(.group-node:focus-within))]:ring-2 [&:focus-within:not(:has(.group-node:focus-within))]:ring-ring/30 [&:hover:not(:has(.group-node:hover))]:ring-2 [&:hover:not(:has(.group-node:hover))]:ring-ring/50">
      <div className="absolute -top-3 left-3">
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-semibold text-xs uppercase tracking-wide">
          {relationship || 'Object field'}
        </span>
      </div>

      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete object field"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {relationshipError?.message || nodeError?.message ? (
        <p className="mb-2 text-destructive text-sm">
          {relationshipError?.message ?? nodeError?.message}
        </p>
      ) : null}

      <LogicalModelCustomCheckEditorContext.Provider value={contextValue}>
        <LogicalModelGroupNodeRenderer
          name={`${name}.child`}
          depth={depth + 1}
        />
      </LogicalModelCustomCheckEditorContext.Provider>

      {childError?.message ? (
        <p className="mt-2 text-destructive text-sm">{childError.message}</p>
      ) : null}
    </div>
  );
}

import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { cn } from '@/lib/utils';
import GroupNodeRenderer from './GroupNodeRenderer';
import RelationshipComboBox from './RelationshipComboBox';
import useCustomCheckEditor, {
  CustomCheckEditorContext,
} from './useCustomCheckEditor';

interface RelationshipNodeRendererProps {
  name: string;
  onRemove?: VoidFunction;
  depth?: number;
  maxDepth?: number;
}

export default function RelationshipNodeRenderer({
  name,
  onRemove,
  depth = 0,
  maxDepth,
}: RelationshipNodeRendererProps) {
  const {
    disabled: editorDisabled,
    schema: parentSchema,
    table: parentTable,
  } = useCustomCheckEditor();
  const { setValue } = useFormContext();

  const relationshipName: string =
    useWatch({ name: `${name}.relationship` }) ?? '';

  const { data: tableData } = useTableSchemaQuery(
    [`default.${parentSchema}.${parentTable}`],
    {
      schema: parentSchema,
      table: parentTable,
      queryOptions: { refetchOnWindowFocus: false },
    },
  );

  const { data: metadata } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const options = useColumnGroups({
    selectedSchema: parentSchema,
    selectedTable: parentTable,
    tableData,
    metadata,
  });

  const resolvedTarget = useMemo(() => {
    if (!relationshipName) {
      return { schema: '', table: '' };
    }
    const match = options.find(
      (opt) => opt.group === 'relationships' && opt.value === relationshipName,
    );

    if (!match) {
      return { schema: '', table: '' };
    }

    const target = match.metadata?.target as
      | {
          schema: string;
          table: string;
        }
      | undefined;

    return {
      schema: target?.schema || 'public',
      table: target?.table || '',
    };
  }, [relationshipName, options]);

  const hasRelationship = Boolean(
    relationshipName && resolvedTarget.schema && resolvedTarget.table,
  );

  const contextValue = useMemo(
    () => ({
      disabled: editorDisabled || !hasRelationship,
      schema: resolvedTarget.schema,
      table: resolvedTarget.table,
    }),
    [
      editorDisabled,
      hasRelationship,
      resolvedTarget.schema,
      resolvedTarget.table,
    ],
  );

  function handleRelationshipChange(value: {
    name: string;
    schema: string;
    table: string;
  }) {
    setValue(`${name}.relationship`, value.name, { shouldDirty: true });
  }

  return (
    <div
      className={cn(
        'group-node relative mt-4 rounded-lg border border-border bg-emerald-50 p-3 pt-5 transition-shadow dark:bg-emerald-950/30 [&:focus-within:not(:has(.group-node:focus-within))]:ring-2 [&:focus-within:not(:has(.group-node:focus-within))]:ring-emerald-400/40 [&:hover:not(:has(.group-node:hover))]:ring-2 [&:hover:not(:has(.group-node:hover))]:ring-emerald-400/30',
      )}
    >
      <div className="absolute -top-3 left-3">
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-semibold text-white text-xs uppercase tracking-wide">
          Relationship
        </span>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={editorDisabled}
          aria-label="Delete relationship"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground text-sm">
          Relationship:
        </span>
        <RelationshipComboBox
          name={name}
          relationship={relationshipName}
          onChange={handleRelationshipChange}
          disabled={editorDisabled}
        />
      </div>

      <CustomCheckEditorContext.Provider value={contextValue}>
        <GroupNodeRenderer
          key={`${resolvedTarget.schema}.${resolvedTarget.table}`}
          name={`${name}.child`}
          depth={depth + 1}
          maxDepth={maxDepth}
        />
      </CustomCheckEditorContext.Provider>
    </div>
  );
}

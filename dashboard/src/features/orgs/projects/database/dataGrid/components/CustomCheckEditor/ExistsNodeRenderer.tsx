import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';
import GroupNodeRenderer from './GroupNodeRenderer';
import TableComboBox from './TableComboBox';
import useCustomCheckEditor, {
  CustomCheckEditorContext,
} from './useCustomCheckEditor';

interface ExistsNodeRendererProps {
  name: string;
  onRemove?: VoidFunction;
  depth?: number;
}

export default function ExistsNodeRenderer({
  name,
  onRemove,
  depth = 0,
}: ExistsNodeRendererProps) {
  const { disabled: editorDisabled } = useCustomCheckEditor();
  const { setValue } = useFormContext();

  const schema: string = useWatch({ name: `${name}.schema` }) ?? '';
  const table: string = useWatch({ name: `${name}.table` }) ?? '';

  const hasTable = Boolean(schema && table);

  const contextValue = useMemo(
    () => ({
      disabled: editorDisabled || !hasTable,
      schema,
      table,
    }),
    [editorDisabled, hasTable, schema, table],
  );

  function handleTableChange(value: { schema: string; table: string }) {
    setValue(`${name}.schema`, value.schema, { shouldDirty: true });
    setValue(`${name}.table`, value.table, { shouldDirty: true });
  }

  return (
    <div
      className={cn(
        'group-node relative mt-4 rounded-lg border border-border bg-blue-50 p-3 pt-5 transition-shadow dark:bg-blue-950/30 [&:focus-within:not(:has(.group-node:focus-within))]:ring-2 [&:focus-within:not(:has(.group-node:focus-within))]:ring-blue-400/40 [&:hover:not(:has(.group-node:hover))]:ring-2 [&:hover:not(:has(.group-node:hover))]:ring-blue-400/30',
      )}
    >
      <div className="absolute -top-3 left-3">
        <span className="rounded-md bg-blue-500 px-2 py-0.5 font-semibold text-white text-xs uppercase tracking-wide">
          Exists
        </span>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={editorDisabled}
          aria-label="Delete exists"
          className="absolute top-2 right-2 rounded p-0.5 opacity-50 hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground text-sm">Table:</span>
        <TableComboBox
          schema={schema}
          table={table}
          disabled={editorDisabled}
          onChange={handleTableChange}
        />
      </div>

      <CustomCheckEditorContext.Provider value={contextValue}>
        <GroupNodeRenderer name={`${name}.where`} depth={depth + 1} />
      </CustomCheckEditorContext.Provider>
    </div>
  );
}

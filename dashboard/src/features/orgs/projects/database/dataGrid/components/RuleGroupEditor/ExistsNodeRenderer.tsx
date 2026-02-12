import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';
import GroupNodeRenderer from './GroupNodeRenderer';
import TableComboBox from './TableComboBox';
import { RuleGroupEditorContext } from './useRuleGroupEditor';

interface ExistsNodeRendererProps {
  name: string;
  onRemove?: VoidFunction;
  disableRemove?: boolean;
  depth?: number;
}

export default function ExistsNodeRenderer({
  name,
  onRemove,
  disableRemove,
  depth = 0,
}: ExistsNodeRendererProps) {
  const { setValue } = useFormContext();

  const schema: string = useWatch({ name: `${name}.schema` }) ?? '';
  const table: string = useWatch({ name: `${name}.table` }) ?? '';

  const hasTable = Boolean(schema && table);

  const contextValue = useMemo(
    () => ({
      disabled: !hasTable,
      schema,
      table,
    }),
    [hasTable, schema, table],
  );

  function handleTableChange(value: { schema: string; table: string }) {
    setValue(`${name}.schema`, value.schema, { shouldDirty: true });
    setValue(`${name}.table`, value.table, { shouldDirty: true });
  }

  return (
    <div
      className={cn(
        'relative mt-4 rounded-lg border-2 border-blue-300 bg-blue-50 p-3 pt-5 dark:border-blue-700 dark:bg-blue-950/30',
      )}
    >
      <div className="absolute -top-3 left-3">
        <span className="rounded-md bg-blue-500 px-2 py-0.5 font-semibold text-white text-xs uppercase tracking-wide">
          Exists
        </span>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground text-sm">Table:</span>
        <TableComboBox
          schema={schema}
          table={table}
          onChange={handleTableChange}
        />
      </div>

      <RuleGroupEditorContext.Provider value={contextValue}>
        <GroupNodeRenderer
          name={`${name}.where`}
          depth={depth + 1}
          allowExistsNodes={false}
        />
      </RuleGroupEditorContext.Provider>

      {onRemove && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            disabled={disableRemove}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Delete Exists
          </Button>
        </div>
      )}
    </div>
  );
}

import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type {
  BaseForeignKeySchemaValues,
  DraftReferencedTable,
} from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/BaseForeignKeyForm';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export interface ReferencedTableSelectProps {
  /**
   * Available tables in the schema.
   */
  options: NormalizedQueryDataRow[];
  /** A table that is being created and is not available from the database yet. */
  draftTable?: DraftReferencedTable;
  /**
   * Called when the referenced table changes, so dependent selections can be
   * reset.
   */
  onReferenceChange?: VoidFunction;
}

export default function ReferencedTableSelect({
  options,
  draftTable,
  onReferenceChange,
}: ReferencedTableSelectProps) {
  const { control } = useFormContext<BaseForeignKeySchemaValues>();
  const referencedSchema = useWatch({ control, name: 'referencedSchema' });
  const referencedTable = useWatch({ control, name: 'referencedTable' });

  const availableTablesInSelectedSchema = Array.from(
    new Set([
      ...options
        .filter(
          ({ table_schema: tableSchema }) => tableSchema === referencedSchema,
        )
        .map(({ table_name: tableName }) => tableName),
      ...(draftTable?.schema === referencedSchema && draftTable.name
        ? [draftTable.name]
        : []),
      ...(referencedTable ? [referencedTable] : []),
    ]),
  );

  return (
    <FormSelect
      control={control}
      name="referencedTable"
      label="Table"
      placeholder="Select a table"
      disabled={!referencedSchema}
      className="border-border"
      contentClassName="z-[1400]"
      transform={{
        in: (value: string) => value ?? '',
        out: (value: string) => {
          if (value !== referencedTable) {
            onReferenceChange?.();
          }
          return value;
        },
      }}
    >
      {availableTablesInSelectedSchema.map((name) => (
        <SelectItem value={name} key={name}>
          {name}
        </SelectItem>
      ))}
    </FormSelect>
  );
}

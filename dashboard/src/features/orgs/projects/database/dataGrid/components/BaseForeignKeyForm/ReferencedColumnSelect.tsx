import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { BaseForeignKeySchemaValues } from './BaseForeignKeyForm';

export default function ReferencedColumnSelect() {
  const { control } = useFormContext<BaseForeignKeySchemaValues>();
  const columnName = useWatch({ name: 'columnName' });
  const referencedSchema = useWatch({ name: 'referencedSchema' });
  const referencedTable = useWatch({ name: 'referencedTable' });

  const { data: tableData, status } = useTableSchemaQuery(
    [`${referencedSchema}.${referencedTable}`],
    {
      schema: referencedSchema,
      table: referencedTable,
      queryOptions: { enabled: !!referencedSchema && !!referencedTable },
    },
  );

  const { columns } = tableData || { columns: [] };

  const availableColumnsInSelectedTable = columns
    .filter(
      ({ is_primary: isPrimary, is_unique: isUnique }) => isPrimary || isUnique,
    )
    .map(({ column_name: availableColumnName }) => availableColumnName);

  const helperText =
    referencedSchema &&
    referencedTable &&
    !availableColumnsInSelectedTable.length &&
    status === 'success'
      ? `There are no available columns in the ${referencedSchema}.${referencedTable} table.`
      : 'Only the primary and unique keys of the referenced table are listed here.';

  return (
    <FormSelect
      control={control}
      name="referencedColumn"
      label="Column"
      placeholder="Select a column"
      disabled={
        !columnName ||
        !referencedSchema ||
        !referencedTable ||
        availableColumnsInSelectedTable.length === 0
      }
      helperText={helperText}
      helperTextClassName="text-xs break-normal"
      contentClassName="z-[1400]"
    >
      {availableColumnsInSelectedTable.map((name) => (
        <SelectItem value={name} key={name}>
          {name}
        </SelectItem>
      ))}
    </FormSelect>
  );
}

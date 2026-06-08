import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseForeignKeySchemaValues } from './BaseForeignKeyForm';

export interface ReferencedTableSelectProps {
  /**
   * Available tables in the schema.
   */
  options: NormalizedQueryDataRow[];
}

export default function ReferencedTableSelect({
  options,
}: ReferencedTableSelectProps) {
  const { control, setValue } = useFormContext<BaseForeignKeySchemaValues>();
  const columnName = useWatch({ name: 'columnName' });
  const referencedSchema = useWatch({ name: 'referencedSchema' });

  const availableTablesInSelectedSchema = options
    .filter(({ table_schema: tableSchema }) => tableSchema === referencedSchema)
    .map(({ table_name: tableName }) => tableName);

  return (
    <FormSelect
      control={control}
      name="referencedTable"
      label="Table"
      placeholder="Select a table"
      disabled={!columnName || !referencedSchema}
      contentClassName="z-[1400]"
      transform={{
        in: (value: string) => value ?? '',
        out: (value: string) => {
          setValue('referencedColumn', '');
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

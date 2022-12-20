import ControlledSelect from '@/components/common/ControlledSelect';
import type { NormalizedQueryDataRow } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { BaseForeignKeyFormValues } from './BaseForeignKeyForm';

export interface ReferencedTableSelectProps {
  /**
   * Available tables in the schema.
   */
  options: NormalizedQueryDataRow[];
}

export default function ReferencedTableSelect({
  options,
}: ReferencedTableSelectProps) {
  const { setValue } = useFormContext<BaseForeignKeyFormValues>();
  const { errors } = useFormState({ name: 'referencedTable' });
  const columnName = useWatch({ name: 'columnName' });
  const referencedSchema = useWatch({ name: 'referencedSchema' });

  const availableTablesInSelectedSchema = options
    .filter(({ table_schema: tableSchema }) => tableSchema === referencedSchema)
    .map(({ table_name: tableName }) => tableName);

  return (
    <ControlledSelect
      id="referencedTable"
      name="referencedTable"
      label="Table"
      fullWidth
      disabled={!columnName || !referencedSchema}
      placeholder="Select a table"
      slotProps={{ listbox: { className: 'max-h-[13rem]' } }}
      hideEmptyHelperText
      error={Boolean(errors.referencedTable)}
      helperText={
        typeof errors.referencedTable?.message === 'string'
          ? errors.referencedTable?.message
          : ''
      }
      onChange={() => {
        setValue('referencedColumn', null);
      }}
    >
      {availableTablesInSelectedSchema.map((name) => (
        <Option value={name} key={name}>
          {name}
        </Option>
      ))}
    </ControlledSelect>
  );
}

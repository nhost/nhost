import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { useFormState, useWatch } from 'react-hook-form';

export default function ReferencedColumnSelect() {
  const { errors } = useFormState({ name: 'referencedColumn' });
  const columnName = useWatch({ name: 'columnName' });
  const referencedSchema = useWatch({ name: 'referencedSchema' });
  const referencedTable = useWatch({ name: 'referencedTable' });

  const { data: tableData, status } = useTableQuery(
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
    status === 'success' ? (
      <span>
        There are no available columns in the{' '}
        <strong>
          {referencedSchema}.{referencedTable}
        </strong>{' '}
        table.
      </span>
    ) : (
      <span>
        Only the primary and unique keys of the referenced table are listed
        here.
      </span>
    );

  return (
    <ControlledSelect
      id="referencedColumn"
      name="referencedColumn"
      label="Column"
      fullWidth
      disabled={
        !columnName ||
        !referencedSchema ||
        !referencedTable ||
        availableColumnsInSelectedTable.length === 0
      }
      placeholder="Select a column"
      slotProps={{ listbox: { className: 'max-h-[13rem]' } }}
      hideEmptyHelperText
      error={Boolean(errors.referencedColumn)}
      helperText={
        typeof errors?.referencedColumn?.message === 'string'
          ? errors?.referencedColumn?.message
          : helperText
      }
    >
      {availableColumnsInSelectedTable.map((name) => (
        <Option value={name} key={name}>
          {name}
        </Option>
      ))}
    </ControlledSelect>
  );
}

import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useMemo } from 'react';
import { useFormState, useWatch } from 'react-hook-form';

export default function PrimaryKeySelect() {
  const { errors } = useFormState({ name: 'primaryKeyIndex' });
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' });

  // List of columns that can be used as an identity column
  const columnsWithNames = useMemo(
    () =>
      (columns || [])
        .map((column, index) => ({
          label: column.name,
          value: column.name,
          id: index,
        }))
        .filter(({ label }) => Boolean(label)),
    [columns],
  );

  return (
    <ControlledSelect
      id="primaryKeyIndex"
      name="primaryKeyIndex"
      label="Primary Key"
      fullWidth
      className="col-span-8 py-3"
      variant="inline"
      placeholder="Select a column"
      hideEmptyHelperText
      error={Boolean(errors.primaryKeyIndex)}
      helperText={
        typeof errors.primaryKeyIndex?.message === 'string'
          ? errors.primaryKeyIndex?.message
          : ''
      }
      disabled={columnsWithNames.length === 0}
    >
      {columnsWithNames.map(({ label, id }) => (
        <Option value={id} key={id}>
          {label}
        </Option>
      ))}
    </ControlledSelect>
  );
}

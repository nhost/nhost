import type { ControlledAutocompleteProps } from '@/components/common/ControlledAutocomplete';
import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import type { PropsWithoutRef } from 'react';

export interface ColumnAutocompleteProps
  extends PropsWithoutRef<Omit<ControlledAutocompleteProps, 'options'>> {
  /**
   * Schema where the `table` is located.
   */
  schema: string;
  /**
   * Table to get the columns from.
   */
  table: string;
}

export default function ColumnAutocomplete({
  schema,
  table,
  ...props
}: ColumnAutocompleteProps) {
  const { data, status, error } = useTableQuery(
    [`default.${schema}.${table}`],
    {
      schema,
      table,
    },
  );

  const { columns } = data || {};

  return (
    <ControlledAutocomplete
      options={
        columns?.map((column) => ({
          value: column.column_name,
          label: column.column_name,
        })) || []
      }
      loading={status === 'loading'}
      error={Boolean(error)}
      helperText={error ? String(error) : ''}
      fullWidth
      {...props}
    />
  );
}

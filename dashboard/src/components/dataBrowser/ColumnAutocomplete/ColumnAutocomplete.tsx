import type { ControlledAutocompleteProps } from '@/components/common/ControlledAutocomplete';
import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import InlineCode from '@/components/common/InlineCode';
import { OptionBase } from '@/components/ui/v2/Option';
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
      queryOptions: { refetchOnWindowFocus: false },
    },
  );

  const { columns, foreignKeyRelations } = data || {};

  const options = columns
    ?.map((column) => ({
      value: column.column_name,
      label: column.column_name,
      group: 'columns',
    }))
    .concat(
      foreignKeyRelations?.map((foreignKeyRelation) => ({
        value: foreignKeyRelation.columnName,
        label: foreignKeyRelation.columnName,
        group: 'relationships',
      })),
    );

  return (
    <ControlledAutocomplete
      options={options || []}
      groupBy={(option) => option.group}
      renderOption={(optionProps, { label, value, group }) =>
        group === 'relationships' ? (
          <OptionBase {...optionProps}>{label}</OptionBase>
        ) : (
          <OptionBase {...optionProps}>
            <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
              <span>{label}</span>

              <InlineCode>{value}</InlineCode>
            </div>
          </OptionBase>
        )
      }
      loading={status === 'loading'}
      error={Boolean(error)}
      helperText={error ? String(error) : ''}
      fullWidth
      {...props}
    />
  );
}

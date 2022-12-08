import type { ControlledAutocompleteProps } from '@/components/common/ControlledAutocomplete';
import ControlledAutocomplete from '@/components/common/ControlledAutocomplete';
import InlineCode from '@/components/common/InlineCode';
import useMetadataQuery from '@/hooks/dataBrowser/useMetadataQuery';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';
import { OptionBase } from '@/ui/v2/Option';
import type { PropsWithoutRef } from 'react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

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
  const [inputValue, setInputValue] = useState<string>('');

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${schema}.${table}`], {
    schema,
    table,
    queryOptions: { refetchOnWindowFocus: false },
  });

  const { columns, foreignKeyRelations } = tableData || {};

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`default.${schema}.${table}.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const { object_relationships, array_relationships } =
    metadata?.tables?.find(
      ({ table: metadataTable }) =>
        metadataTable.name === table && metadataTable.schema === schema,
    ) || {};

  // const lastActiveColumn =
  //   inputValue?.split('.').slice(-1)?.[0] || inputValue || '';

  const columnOptions: AutocompleteOption[] =
    columns
      ?.filter(
        (column) =>
          !foreignKeyRelations?.some(
            (foreignKeyRelation) =>
              foreignKeyRelation.columnName === column.column_name,
          ),
      )
      .map((column) => ({
        label: column.column_name,
        value: column.column_name,
        group: 'columns',
        metadata: { type: column.udt_name },
      })) || [];

  const relationshipOptions: AutocompleteOption[] =
    foreignKeyRelations?.map((foreignKeyRelation) => ({
      label: foreignKeyRelation.columnName,
      value: foreignKeyRelation.columnName,
      group: 'relationships',
    })) || [];

  return (
    <ControlledAutocomplete
      componentsProps={{
        input: {
          slotProps: { input: { className: twMerge(inputValue && '!pl-0') } },
          startAdornment: inputValue ? (
            <span className="ml-2">{table}.</span>
          ) : null,
        },
      }}
      options={[...columnOptions, ...relationshipOptions] || []}
      groupBy={(option) => option.group}
      renderOption={(
        optionProps,
        { label, value, metadata: optionMetadata, group },
      ) =>
        group === 'relationships' ? (
          <OptionBase {...optionProps}>{label}</OptionBase>
        ) : (
          <OptionBase {...optionProps}>
            <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
              <span>{label}</span>

              <InlineCode>{optionMetadata?.type || value}</InlineCode>
            </div>
          </OptionBase>
        )
      }
      loading={tableStatus === 'loading' || metadataStatus === 'loading'}
      error={Boolean(tableError) || Boolean(metadataError)}
      helperText={
        tableError || metadataError ? String(tableError || metadataError) : ''
      }
      fullWidth
      inputValue={inputValue}
      onInputChange={(_event, value) => {
        setInputValue(value);
        console.log(value);
      }}
      onChange={(_event, value) => {
        if (
          typeof value === 'string' ||
          ('group' in value && value.group === 'columns')
        ) {
          return;
        }

        setInputValue((currentInputValue) => `${currentInputValue}.`);
        // if (typeof value === 'string') {
        //   setSelectedColumn(value);
        //   setInputValue(null);

        //   return;
        // }

        // if ('group' in value && value.group === 'relationships') {
        //   setSelectedColumn((currentValue) =>
        //     currentValue
        //       ? `${currentValue}${value.value}`
        //       : `${table}.${value.value}.`,
        //   );

        //   setInputValue(null);
        // }
      }}
      {...props}
    />
  );
}

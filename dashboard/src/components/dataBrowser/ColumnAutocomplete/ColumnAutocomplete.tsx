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
  schema: defaultSchema,
  table: defaultTable,
  ...props
}: ColumnAutocompleteProps) {
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('');
  const selectedTable =
    selectedRelationship.split('.').slice(-1)?.[0] || defaultTable;
  const hasSelectedColumnOrRelationship =
    Boolean(selectedColumn) || Boolean(selectedRelationship);

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${defaultSchema}.${selectedTable}`], {
    schema: defaultSchema,
    table: selectedTable,
    queryOptions: { refetchOnWindowFocus: false },
  });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const { object_relationships, array_relationships } =
    metadata?.tables?.find(
      ({ table: metadataTable }) =>
        metadataTable.name === selectedTable &&
        metadataTable.schema === defaultSchema,
    ) || {};

  const columnAliasMap = [
    ...(object_relationships || []),
    ...(array_relationships || []),
  ].reduce((map, currentRelationship) => {
    const { foreign_key_constraint_on } = currentRelationship?.using || {};

    if (typeof foreign_key_constraint_on !== 'string') {
      return map.set(
        foreign_key_constraint_on.column,
        currentRelationship.name,
      );
    }

    return map.set(foreign_key_constraint_on, currentRelationship.name);
  }, new Map<string, string>());

  const { columns, foreignKeyRelations } = tableData || {};

  const columnTargetMap = foreignKeyRelations?.reduce(
    (map, currentRelation) =>
      map.set(currentRelation.columnName, {
        schema: currentRelation.referencedSchema || 'public',
        table: currentRelation.referencedTable,
      }),
    new Map<string, { schema: string; table: string }>(),
  );

  const columnOptions: AutocompleteOption[] =
    columns?.map((column) => {
      if (columnAliasMap.has(column.column_name)) {
        return {
          label: columnAliasMap.get(column.column_name),
          value: columnAliasMap.get(column.column_name),
          group: 'relationships',
          metadata: { target: columnTargetMap.get(column.column_name) || null },
        };
      }

      return {
        label: column.column_name,
        value: column.column_name,
        group: 'columns',
        metadata: { type: column.udt_name },
      };
    }) || [];

  return (
    <ControlledAutocomplete
      slotProps={{
        input: {
          slotProps: {
            input: {
              className: twMerge(hasSelectedColumnOrRelationship && '!pl-0'),
            },
          },
          startAdornment: hasSelectedColumnOrRelationship ? (
            <span className="ml-2">
              <span className="text-greyscaleGrey">{defaultTable}</span>.
              {selectedRelationship && <span>{selectedRelationship}.</span>}
            </span>
          ) : null,
        },
      }}
      options={columnOptions}
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
      freeSolo
      inputValue={inputValue}
      onInputChange={(_event, value) => setInputValue(value)}
      onChange={(_event, value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return;
        }

        if ('group' in value && value.group === 'columns') {
          setSelectedColumn(value.value);

          return;
        }

        setSelectedRelationship((currentRelationship) =>
          currentRelationship
            ? `${currentRelationship}.${value.metadata.target.table}`
            : value.metadata.target.table,
        );

        setInputValue('');
      }}
      {...props}
    />
  );
}

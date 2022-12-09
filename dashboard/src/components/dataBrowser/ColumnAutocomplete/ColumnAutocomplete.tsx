import InlineCode from '@/components/common/InlineCode';
import useMetadataQuery from '@/hooks/dataBrowser/useMetadataQuery';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';
import { AutocompletePopper } from '@/ui/v2/Autocomplete';
import IconButton from '@/ui/v2/IconButton';
import type { InputProps } from '@/ui/v2/Input';
import Input from '@/ui/v2/Input';
import List from '@/ui/v2/List';
import { OptionBase } from '@/ui/v2/Option';
import { OptionGroupBase } from '@/ui/v2/OptionGroup';
import Text from '@/ui/v2/Text';
import { ArrowLeftIcon } from '@heroicons/react/solid';
import type { AutocompleteGroupedOption } from '@mui/base/AutocompleteUnstyled';
import { useAutocomplete } from '@mui/base/AutocompleteUnstyled';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';
import { autocompleteClasses } from '@mui/material/Autocomplete';
import type { PropsWithoutRef } from 'react';
import { useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ColumnAutocompleteProps extends PropsWithoutRef<InputProps> {
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

  const {
    popupOpen,
    anchorEl,
    setAnchorEl,
    getRootProps,
    getInputLabelProps,
    getInputProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
  } = useAutocomplete({
    id: props?.name,
    options: columnOptions,
    openOnFocus: true,
    groupBy: (option) => option.group,
    isOptionEqualToValue: (option, value) => {
      if (!value) {
        return false;
      }

      if (typeof value === 'string') {
        return option.value === value;
      }

      return option.value === value.value && option.custom === value.custom;
    },
    onChange: (_event, value) => {
      if (typeof value === 'string' || Array.isArray(value) || !value) {
        return;
      }

      if (value && 'group' in value && value.group === 'columns') {
        setSelectedColumn(value.value);

        return;
      }

      setSelectedRelationship((currentRelationship) =>
        currentRelationship
          ? `${currentRelationship}.${value.metadata.target.table}`
          : value.metadata.target.table,
      );

      setInputValue('');
    },
  });

  function renderGroup(params: AutocompleteRenderGroupParams) {
    return (
      <li key={params.key}>
        <OptionGroupBase>{params.group}</OptionGroupBase>

        <List>{params.children}</List>
      </li>
    );
  }

  function renderOption(option: AutocompleteOption<string>, index: number) {
    const optionProps = getOptionProps({ option, index });

    return (
      <OptionBase
        {...optionProps}
        className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5"
      >
        <span>{option.label}</span>

        <InlineCode>{option.metadata?.type || option.value}</InlineCode>
      </OptionBase>
    );
  }

  return (
    <div>
      <div {...getRootProps()}>
        <Input
          {...props}
          fullWidth
          componentsProps={{
            label: getInputLabelProps(),
            input: { ref: setAnchorEl },
            inputRoot: {
              ...getInputProps(),
              className: twMerge(hasSelectedColumnOrRelationship && '!pl-0'),
            },
          }}
          error={Boolean(tableError || metadataError)}
          helperText={String(tableError || metadataError || '')}
          onChange={(event) => setInputValue(event.target.value)}
          value={inputValue}
          startAdornment={
            hasSelectedColumnOrRelationship ? (
              <span className="ml-2">
                <span className="text-greyscaleGrey">{defaultTable}</span>.
                {selectedRelationship && <span>{selectedRelationship}.</span>}
              </span>
            ) : null
          }
        />
      </div>

      <AutocompletePopper
        modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
        placement="bottom-start"
        open={popupOpen}
        anchorEl={anchorEl}
        style={{ width: anchorEl?.parentElement?.clientWidth }}
      >
        <div className={autocompleteClasses.paper}>
          <div className="px-3 py-2.5 border-b-1 border-greyscale-100 grid grid-flow-col gap-2 justify-start items-center">
            {selectedRelationship !== '' && (
              <IconButton variant="borderless" color="secondary">
                <ArrowLeftIcon className="w-4 h-4" />
              </IconButton>
            )}

            <Text className="!text-greyscaleMedium">{defaultTable}</Text>
          </div>

          {(tableStatus === 'loading' || metadataStatus === 'loading') && (
            <div className="p-2">
              <ActivityIndicator label="Loading..." />
            </div>
          )}

          {groupedOptions.length > 0 && (
            <List
              {...getListboxProps()}
              className={autocompleteClasses.listbox}
            >
              {(
                groupedOptions as AutocompleteGroupedOption<
                  typeof columnOptions[number]
                >[]
              ).map((optionGroup) =>
                renderGroup({
                  key: `${optionGroup.key}`,
                  group: optionGroup.group,
                  children: optionGroup.options.map((option, index) =>
                    renderOption(option, optionGroup.index + index),
                  ),
                }),
              )}
            </List>
          )}

          {groupedOptions.length === 0 && Boolean(anchorEl) && (
            <Text className={autocompleteClasses.noOptions}>No options</Text>
          )}
        </div>
      </AutocompletePopper>
    </div>
  );
}

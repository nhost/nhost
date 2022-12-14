import InlineCode from '@/components/common/InlineCode';
import useMetadataQuery from '@/hooks/dataBrowser/useMetadataQuery';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
import type { HasuraMetadataTable } from '@/types/dataBrowser';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import type { AutocompleteOption } from '@/ui/v2/Autocomplete';
import { AutocompletePopper } from '@/ui/v2/Autocomplete';
import IconButton from '@/ui/v2/IconButton';
import ArrowLeftIcon from '@/ui/v2/icons/ArrowLeftIcon';
import type { InputProps } from '@/ui/v2/Input';
import Input from '@/ui/v2/Input';
import List from '@/ui/v2/List';
import { OptionBase } from '@/ui/v2/Option';
import { OptionGroupBase } from '@/ui/v2/OptionGroup';
import Text from '@/ui/v2/Text';
import type { AutocompleteGroupedOption } from '@mui/base/AutocompleteUnstyled';
import { useAutocomplete } from '@mui/base/AutocompleteUnstyled';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';
import { autocompleteClasses } from '@mui/material/Autocomplete';
import type {
  ForwardedRef,
  HTMLAttributes,
  PropsWithoutRef,
  SyntheticEvent,
} from 'react';
import { forwardRef, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ColumnAutocompleteProps
  extends Omit<PropsWithoutRef<InputProps>, 'onChange'> {
  /**
   * Schema where the `table` is located.
   */
  schema: string;
  /**
   * Table to get the columns from.
   */
  table: string;
  /**
   * Function to be called when the value changes.
   */
  onChange?: (
    event: SyntheticEvent,
    value: {
      value: string;
      type: string;
    },
  ) => void;
  /**
   * Class name to be applied to the root element.
   */
  rootClassName?: string;
  /**
   * Determines if the autocomplete should allow relationships.
   */
  disableRelationships?: boolean;
}

function renderGroup(params: AutocompleteRenderGroupParams) {
  return (
    <li key={params.key}>
      <OptionGroupBase>{params.group}</OptionGroupBase>

      <List>{params.children}</List>
    </li>
  );
}

function renderOption(
  option: AutocompleteOption<string>,
  optionProps: HTMLAttributes<HTMLLIElement>,
) {
  return (
    <OptionBase
      {...optionProps}
      className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5"
    >
      <span>{option.label}</span>

      {option.group === 'columns' && (
        <InlineCode>{option.metadata?.type || option.value}</InlineCode>
      )}
    </OptionBase>
  );
}

function ColumnAutocomplete(
  {
    rootClassName,
    schema: defaultSchema,
    table: defaultTable,
    value: externalValue,
    disableRelationships,
    ...props
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [initialized, setInitialized] = useState(false);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedColumn, setSelectedColumn] =
    useState<AutocompleteOption>(null);
  const [selectedRelationships, setSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);
  const [asyncSelectedRelationships, setAsyncSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);

  const columnPath = (externalValue as string)?.split('.');
  const [remainingPath, setRemainingPath] = useState(
    columnPath?.slice(selectedRelationships.length - columnPath.length) || [],
  );

  const activeRelationship =
    selectedRelationships[selectedRelationships.length - 1];

  const activeAsyncRelationship =
    asyncSelectedRelationships[asyncSelectedRelationships.length - 1];

  const selectedSchema = !initialized
    ? activeAsyncRelationship?.schema || defaultSchema
    : activeRelationship?.schema || defaultSchema;

  const selectedTable = !initialized
    ? activeAsyncRelationship?.table || defaultTable
    : activeRelationship?.table || defaultTable;

  const relationshipDotNotation =
    selectedRelationships?.length > 0
      ? selectedRelationships.map((relationship) => relationship.name).join('.')
      : '';

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
    isFetching: isTableFetching,
  } = useTableQuery([`default.${selectedSchema}.${selectedTable}`], {
    schema: selectedSchema,
    table: selectedTable,
    queryOptions: { refetchOnWindowFocus: false },
  });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
    isFetching: isMetadataFetching,
  } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const { object_relationships, array_relationships } =
    metadata?.tables?.find(
      ({ table: metadataTable }) =>
        metadataTable.name === selectedTable &&
        metadataTable.schema === selectedSchema,
    ) || {};

  useEffect(() => {
    if (
      remainingPath?.length !== 1 ||
      isTableFetching ||
      tableStatus === 'loading' ||
      !tableData?.columns
    ) {
      return;
    }

    const [activeColumn] = remainingPath;

    // If there is a single column in the path, it means that we can look for it
    // in the table columns
    if (
      tableData.columns.some((column) => column.column_name === activeColumn)
    ) {
      setSelectedColumn({
        value: activeColumn,
        label: activeColumn,
        group: 'columns',
        metadata: tableData.columns.find(
          (column) => column.column_name === activeColumn,
        ),
      });
      setRemainingPath(remainingPath.slice(1));
      setInputValue(activeColumn);
    }
  }, [remainingPath, isTableFetching, tableData?.columns, tableStatus]);

  useEffect(() => {
    if (
      remainingPath.length < 2 ||
      tableStatus === 'loading' ||
      isTableFetching ||
      metadataStatus === 'loading' ||
      isMetadataFetching ||
      !tableData?.columns
    ) {
      return;
    }

    const metadataMap = metadata.tables.reduce(
      (map, metadataTable) =>
        map.set(
          `${metadataTable.table.schema}.${metadataTable.table.name}`,
          metadataTable,
        ),
      new Map<string, HasuraMetadataTable>(),
    );

    const [nextPath] = remainingPath.slice(0, remainingPath.length - 1);
    const tableMetadata = metadataMap.get(`${selectedSchema}.${selectedTable}`);
    const currentRelationship = [
      ...(tableMetadata.object_relationships || []),
      ...(tableMetadata.array_relationships || []),
    ].find(({ name }) => name === nextPath);

    if (!currentRelationship) {
      return;
    }

    const { foreign_key_constraint_on: metadataConstraint } =
      currentRelationship.using || {};

    // In some cases the metadata already contains the schema and table name
    if (typeof metadataConstraint !== 'string') {
      setAsyncSelectedRelationships((currentRelationships) => [
        ...currentRelationships,
        {
          schema: metadataConstraint.table.schema || 'public',
          table: metadataConstraint.table.name,
          name: nextPath,
        },
      ]);

      setRemainingPath(remainingPath.slice(1));

      return;
    }

    const foreignKeyRelation = tableData?.foreignKeyRelations?.find(
      ({ columnName }) => {
        const { foreign_key_constraint_on } = currentRelationship.using || {};

        if (!foreign_key_constraint_on) {
          return false;
        }

        if (typeof foreign_key_constraint_on === 'string') {
          return foreign_key_constraint_on === columnName;
        }

        return foreign_key_constraint_on.column === columnName;
      },
    );

    if (!foreignKeyRelation) {
      return;
    }

    setAsyncSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      {
        schema: foreignKeyRelation.referencedSchema || 'public',
        table: foreignKeyRelation.referencedTable,
        name: nextPath,
      },
    ]);

    setRemainingPath(remainingPath.slice(1));
  }, [
    isMetadataFetching,
    isTableFetching,
    remainingPath,
    selectedSchema,
    selectedTable,
    metadata?.tables,
    tableData?.columns,
    tableData?.foreignKeyRelations,
    tableStatus,
    metadataStatus,
  ]);

  useEffect(() => {
    if (remainingPath?.length > 0 || initialized) {
      return;
    }

    setInitialized(true);
  }, [initialized, remainingPath.length]);

  useEffect(() => {
    if (!initialized || selectedRelationships.length > 0) {
      return;
    }

    setSelectedRelationships(asyncSelectedRelationships);
  }, [initialized, asyncSelectedRelationships, selectedRelationships.length]);

  const objectAndArrayRelationships = [
    ...(object_relationships || []),
    ...(array_relationships || []),
  ].map((relationship) => {
    const { foreign_key_constraint_on } = relationship?.using || {};

    if (typeof foreign_key_constraint_on === 'string') {
      return {
        schema: selectedSchema,
        table: selectedTable,
        column: foreign_key_constraint_on,
        name: relationship.name,
      };
    }

    return {
      schema: foreign_key_constraint_on.table.schema,
      table: foreign_key_constraint_on.table.name,
      column: foreign_key_constraint_on.column,
      name: relationship.name,
    };
  });

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
    columns?.map((column) => ({
      label: column.column_name,
      value: column.column_name,
      group: 'columns',
      metadata: { type: column.udt_name },
    })) || [];

  const columnWithRelationshipOptions: AutocompleteOption[] = [
    ...columnOptions,
    ...objectAndArrayRelationships.map((relationship) => ({
      label: relationship.name,
      value: relationship.name,
      group: 'relationships',
      metadata: {
        target: {
          ...(columnTargetMap.get(relationship.column) || {}),
          name: relationship.name,
        },
      },
    })),
  ];

  function isOptionEqualToValue(
    option: AutocompleteOption,
    value: NonNullable<string | AutocompleteOption>,
  ) {
    if (!value) {
      return false;
    }

    if (typeof value === 'string') {
      return option.value === value;
    }

    return option.value === value.value && option.custom === value.custom;
  }

  function handleChange(
    event: SyntheticEvent,
    value: NonNullable<string | AutocompleteOption>,
  ) {
    if (typeof value === 'string' || Array.isArray(value) || !value) {
      return;
    }

    if ('group' in value && value.group === 'columns') {
      setSelectedColumn(value);
      setOpen(false);
      setInputValue(value.value);

      props.onChange?.(event, {
        value:
          selectedRelationships.length > 0
            ? [relationshipDotNotation, value.value].join('.')
            : value.value,
        type: value.metadata?.type,
      });

      return;
    }

    setInputValue('');
    setSelectedColumn(null);
    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      value.metadata?.target,
    ]);
  }

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
    open,
    inputValue,
    id: props?.name,
    options: disableRelationships
      ? columnOptions
      : columnWithRelationshipOptions,
    openOnFocus: true,
    disableCloseOnSelect: true,
    value: selectedColumn,
    onClose: () => setOpen(false),
    groupBy: (option) => option.group,
    isOptionEqualToValue,
    onChange: handleChange,
  });

  return (
    <>
      <div {...getRootProps()} className={rootClassName}>
        <Input
          {...props}
          ref={ref}
          fullWidth
          slotProps={{
            ...(props.slotProps || {}),
            label: getInputLabelProps(),
            input: { ...(props.slotProps?.input || {}), ref: setAnchorEl },
            inputRoot: {
              ...getInputProps(),
              className: twMerge(
                Boolean(selectedColumn) || Boolean(activeRelationship)
                  ? '!pl-0'
                  : null,
                props.slotProps?.inputRoot?.className,
              ),
            },
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          error={Boolean(tableError || metadataError)}
          helperText={String(tableError || metadataError || '')}
          onChange={(event) => setInputValue(event.target.value)}
          value={inputValue}
          startAdornment={
            selectedColumn || activeRelationship ? (
              <Text className="!ml-2">
                <span className="text-greyscaleGrey">{defaultTable}</span>.
                {relationshipDotNotation && (
                  <span>{relationshipDotNotation}.</span>
                )}
              </Text>
            ) : null
          }
          endAdornment={
            tableStatus === 'loading' ||
            metadataStatus === 'loading' ||
            !initialized ? (
              <ActivityIndicator className="mr-2" />
            ) : null
          }
        />
      </div>

      <AutocompletePopper
        onMouseDown={(event) => event.preventDefault()}
        modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
        placement="bottom-start"
        open={popupOpen}
        anchorEl={anchorEl}
        style={{ width: anchorEl?.parentElement?.clientWidth }}
      >
        <div className={autocompleteClasses.paper}>
          <div className="px-3 py-2.5 border-b-1 border-greyscale-100 grid grid-flow-col gap-2 justify-start items-center">
            {selectedRelationships.length > 0 && (
              <IconButton
                variant="borderless"
                color="secondary"
                onClick={(event) => {
                  event.stopPropagation();

                  setInputValue('');
                  setSelectedColumn(null);
                  setSelectedRelationships((activeRelationships) =>
                    activeRelationships.slice(0, -1),
                  );
                }}
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </IconButton>
            )}

            <Text className="truncate">
              <span className="!text-greyscaleMedium">{defaultTable}</span>

              {relationshipDotNotation && (
                <span>.{relationshipDotNotation}</span>
              )}
            </Text>
          </div>

          {(tableStatus === 'loading' ||
            metadataStatus === 'loading' ||
            !initialized) && (
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
                    renderOption(
                      option,
                      getOptionProps({
                        option,
                        index: optionGroup.index + index,
                      }),
                    ),
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
    </>
  );
}

export default forwardRef(ColumnAutocomplete);

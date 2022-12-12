import InlineCode from '@/components/common/InlineCode';
import useMetadataQuery from '@/hooks/dataBrowser/useMetadataQuery';
import useTableQuery from '@/hooks/dataBrowser/useTableQuery';
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
import type { ForwardedRef, PropsWithoutRef, SyntheticEvent } from 'react';
import { forwardRef, useState } from 'react';
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
  onChange?: (event: SyntheticEvent, value: string) => void;
  /**
   * Class name to be applied to the root element.
   */
  rootClassName?: string;
}

function ColumnAutocomplete(
  {
    rootClassName,
    schema: defaultSchema,
    table: defaultTable,
    ...props
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<AutocompleteOption>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>(
    [],
  );

  const currentRelationshipTable =
    selectedRelationships[selectedRelationships.length - 1];
  const selectedTable = currentRelationshipTable || defaultTable;

  const hasSelectedColumnOrRelationship =
    Boolean(selectedColumn) || Boolean(currentRelationshipTable);

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
    disableCloseOnSelect: true,
    value: selectedValue,
    open,
    onClose: () => setOpen(false),
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
    onChange: (event, value) => {
      if (typeof value === 'string' || Array.isArray(value) || !value) {
        return;
      }

      if (value && 'group' in value && value.group === 'columns') {
        setSelectedValue(value);
        setSelectedColumn(value.value);
        setOpen(false);

        props.onChange?.(
          event,
          selectedRelationships.length > 0
            ? [selectedRelationships.join('.'), value.value].join('.')
            : value.value,
        );

        return;
      }

      setInputValue('');
      setSelectedValue(null);
      setSelectedRelationships((currentRelationship) => [
        ...currentRelationship,
        value.metadata?.target.table,
      ]);
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
                hasSelectedColumnOrRelationship && '!pl-0',
                props.slotProps?.inputRoot?.className,
              ),
            },
          }}
          onClick={() => setOpen(true)}
          error={Boolean(tableError || metadataError)}
          helperText={String(tableError || metadataError || '')}
          onChange={(event) => setInputValue(event.target.value)}
          value={inputValue}
          startAdornment={
            hasSelectedColumnOrRelationship ? (
              <span className="ml-2">
                <span className="text-greyscaleGrey">{defaultTable}</span>.
                {selectedRelationships.length > 0 && (
                  <span>{selectedRelationships.join('.')}.</span>
                )}
              </span>
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

                  setSelectedValue(null);
                  setSelectedRelationships((currentRelationships) =>
                    currentRelationships.slice(0, -1),
                  );
                }}
              >
                <ArrowLeftIcon className="w-4 h-4" />
              </IconButton>
            )}

            <Text>
              <span className="!text-greyscaleMedium">{defaultTable}</span>

              {selectedRelationships.length > 0 && (
                <span>.{selectedRelationships.join('.')}</span>
              )}
            </Text>
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
    </>
  );
}

export default forwardRef(ColumnAutocomplete);

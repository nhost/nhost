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
import type {
  ForwardedRef,
  HTMLAttributes,
  PropsWithoutRef,
  SyntheticEvent,
} from 'react';
import { forwardRef, useRef, useState } from 'react';
import mergeRefs from 'react-merge-refs';
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
    ...props
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const inputRef = useRef<HTMLInputElement>();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedValue, setSelectedValue] = useState<AutocompleteOption>(null);
  const [selectedRelationships, setSelectedRelationships] = useState<
    { schema: string; table: string; name: string }[]
  >([]);

  const activeRelationship =
    selectedRelationships[selectedRelationships.length - 1];
  const selectedSchema = activeRelationship?.schema || defaultSchema;
  const selectedTable = activeRelationship?.table || defaultTable;
  const relationshipDotNotation =
    selectedRelationships?.length > 0
      ? selectedRelationships.map((relationship) => relationship.name).join('.')
      : '';

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
  } = useTableQuery([`default.${selectedSchema}.${selectedTable}`], {
    schema: selectedSchema,
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
        metadataTable.schema === selectedSchema,
    ) || {};

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

    if (value && 'group' in value && value.group === 'columns') {
      setSelectedValue(value);
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
    setSelectedValue(null);
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
    options: columnWithRelationshipOptions,
    openOnFocus: true,
    disableCloseOnSelect: true,
    value: selectedValue,
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
          ref={mergeRefs([inputRef, ref])}
          fullWidth
          slotProps={{
            ...(props.slotProps || {}),
            label: getInputLabelProps(),
            input: { ...(props.slotProps?.input || {}), ref: setAnchorEl },
            inputRoot: {
              ...getInputProps(),
              className: twMerge(
                Boolean(selectedValue) || Boolean(activeRelationship)
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
            selectedValue || activeRelationship ? (
              <Text className="!ml-2">
                <span className="text-greyscaleGrey">{defaultTable}</span>.
                {relationshipDotNotation && (
                  <span>{relationshipDotNotation}.</span>
                )}
              </Text>
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
                  setInputValue('');
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

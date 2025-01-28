import { InlineCode } from '@/components/presentational/InlineCode';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type { AutocompleteOption } from '@/components/ui/v2/Autocomplete';
import { AutocompletePopper } from '@/components/ui/v2/Autocomplete';
import { Box } from '@/components/ui/v2/Box';
import { IconButton } from '@/components/ui/v2/IconButton';
import { ArrowLeftIcon } from '@/components/ui/v2/icons/ArrowLeftIcon';
import type { InputProps } from '@/components/ui/v2/Input';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { List } from '@/components/ui/v2/List';
import { OptionBase } from '@/components/ui/v2/Option';
import { OptionGroupBase } from '@/components/ui/v2/OptionGroup';
import { Text } from '@/components/ui/v2/Text';
import { useMetadataQuery } from '@/features/database/dataGrid/hooks/useMetadataQuery';
import { useTableQuery } from '@/features/database/dataGrid/hooks/useTableQuery';
import { getTruncatedText } from '@/utils/getTruncatedText';
import type { AutocompleteGroupedOption } from '@mui/base/useAutocomplete';
import { useAutocomplete } from '@mui/base/useAutocomplete';
import type { AutocompleteRenderGroupParams } from '@mui/material/Autocomplete';
import { autocompleteClasses } from '@mui/material/Autocomplete';
import type {
  ChangeEvent,
  ForwardedRef,
  HTMLAttributes,
  PropsWithoutRef,
  SyntheticEvent,
} from 'react';
import { forwardRef, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import type { UseAsyncValueOptions } from './useAsyncValue';
import useAsyncValue from './useAsyncValue';
import type { UseColumnGroupsOptions } from './useColumnGroups';
import useColumnGroups from './useColumnGroups';

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
      columnMetadata?: Record<string, any>;
      disableReset?: boolean;
    },
  ) => void;
  /**
   * Function to be called when the input is asynchronously initialized.
   */
  onInitialized?: UseAsyncValueOptions['onInitialized'];
  /**
   * Class name to be applied to the root element.
   */
  rootClassName?: string;
  /**
   * Determines if the autocomplete should allow relationships.
   */
  disableRelationships?: UseColumnGroupsOptions['disableRelationships'];
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
      <Text component="span">{option.label}</Text>

      {option.group === 'columns' && (
        <InlineCode>{option.metadata?.udt_name || option.value}</InlineCode>
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
    onChange,
    onInitialized,
    ...props
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [open, setOpen] = useState(false);
  const [activeRelationship, setActiveRelationship] = useState<{
    schema: string;
    table: string;
    name: string;
  }>();
  const selectedSchema = activeRelationship?.schema || defaultSchema;
  const selectedTable = activeRelationship?.table || defaultTable;

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
    isFetching: isTableFetching,
  } = useTableQuery([`default.${selectedSchema}.${selectedTable}`], {
    schema: selectedSchema,
    table: selectedTable,
    preventRowFetching: true,
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

  const {
    initialized,
    inputValue,
    setInputValue,
    selectedColumn,
    setSelectedColumn,
    selectedRelationships,
    setSelectedRelationships,
    relationshipDotNotation,
    activeRelationship: asyncActiveRelationship,
  } = useAsyncValue({
    selectedSchema,
    selectedTable,
    initialValue: externalValue as string,
    isTableLoading: tableStatus === 'loading' || isTableFetching,
    isMetadataLoading: metadataStatus === 'loading' || isMetadataFetching,
    tableData,
    metadata,
    onInitialized,
  });

  useEffect(() => {
    setActiveRelationship(asyncActiveRelationship);
  }, [asyncActiveRelationship]);

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

      onChange?.(event, {
        value:
          selectedRelationships.length > 0
            ? [relationshipDotNotation, value.value].join('.')
            : value.value,
        columnMetadata: value.metadata,
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

  const options = useColumnGroups({
    selectedSchema,
    selectedTable,
    tableData,
    metadata,
    disableRelationships,
  });

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
    options,
    id: props?.name,
    openOnFocus: !props.disabled,
    disableCloseOnSelect: true,
    value: selectedColumn,
    onClose: () => setOpen(false),
    groupBy: (option) => option.group,
    isOptionEqualToValue,
    onChange: handleChange,
  });

  function handleInputValueChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { value } = event.target;
    setInputValue(value);

    setSelectedColumn({
      value,
      label: value,
      metadata: selectedColumn?.metadata || {
        table_schema: selectedSchema,
        table_name: selectedTable,
      },
    });

    onChange?.(event, {
      value:
        selectedRelationships.length > 0
          ? [relationshipDotNotation, value].join('.')
          : value,
      columnMetadata: {
        table_schema: selectedSchema,
        table_name: selectedTable,
      },
    });
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
            input: {
              ...(props.slotProps?.input || {}),
              ref: setAnchorEl,
              sx: [
                ...(Array.isArray(props.slotProps?.input?.sx)
                  ? props.slotProps.input.sx
                  : [props.slotProps?.input?.sx || {}]),
                {
                  [`& .${inputClasses.input}`]: {
                    backgroundColor: 'transparent',
                  },
                },
              ],
            },
            inputRoot: {
              ...getInputProps(),
              className: twMerge(
                Boolean(selectedColumn) || Boolean(relationshipDotNotation)
                  ? '!pl-0'
                  : null,
                props.slotProps?.inputRoot?.className,
              ),
            },
          }}
          onFocus={() => {
            if (props.disabled) {
              return;
            }

            setOpen(true);
          }}
          onClick={() => {
            if (props.disabled) {
              return;
            }

            setOpen(true);
          }}
          error={Boolean(tableError || metadataError) || props.error}
          helperText={
            String(tableError || metadataError || '') || props.helperText
          }
          onChange={handleInputValueChange}
          value={inputValue}
          startAdornment={
            selectedColumn || relationshipDotNotation ? (
              <Text
                component="span"
                sx={{
                  color: props.disabled ? 'text.disabled' : 'text.primary',
                }}
                className="!ml-2 flex-shrink-0 truncate lg:max-w-[200px]"
              >
                <Text component="span" color="disabled">
                  {selectedTable}
                </Text>
                .
                {relationshipDotNotation && (
                  <>
                    <span className="hidden lg:inline">
                      {getTruncatedText(relationshipDotNotation, 15, 'end')}.
                    </span>

                    <span className="inline lg:hidden">
                      {getTruncatedText(relationshipDotNotation, 35, 'end')}.
                    </span>
                  </>
                )}
              </Text>
            ) : null
          }
          endAdornment={
            tableStatus === 'loading' ||
            metadataStatus === 'loading' ||
            !initialized ? (
              <ActivityIndicator className="mr-2" delay={500} />
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
        <Box
          className={autocompleteClasses.paper}
          sx={{
            borderWidth: (theme) => (theme.palette.mode === 'dark' ? 1 : 0),
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.400' : 'none',
          }}
        >
          <Box
            className="grid grid-flow-col items-center justify-start gap-2 border-b-1 px-3 py-2.5"
            sx={{ backgroundColor: 'transparent' }}
          >
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
                <ArrowLeftIcon className="h-4 w-4" />
              </IconButton>
            )}

            <Text className="direction-rtl truncate text-left">
              <Text component="span" color="disabled">
                {defaultTable}
              </Text>

              {relationshipDotNotation && (
                <>
                  <span className="hidden lg:inline">
                    .{getTruncatedText(relationshipDotNotation, 20, 'start')}
                  </span>

                  <span className="inline lg:hidden">
                    .{relationshipDotNotation}
                  </span>
                </>
              )}
            </Text>
          </Box>

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
                  (typeof options)[number]
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
        </Box>
      </AutocompletePopper>
    </>
  );
}

export default forwardRef(ColumnAutocomplete);

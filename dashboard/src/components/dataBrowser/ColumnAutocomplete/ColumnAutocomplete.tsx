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
import getTruncatedText from '@/utils/common/getTruncatedText';
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
          onChange={(event) => setInputValue(event.target.value)}
          value={inputValue}
          startAdornment={
            selectedColumn || relationshipDotNotation ? (
              <Text
                className={twMerge(
                  '!ml-2 lg:max-w-[200px] flex-shrink-0 truncate',
                  props.disabled && 'text-greyscaleGrey',
                )}
              >
                <span className="text-greyscaleGrey">{defaultTable}</span>.
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

            <Text className="truncate direction-rtl text-left">
              <span className="!text-greyscaleMedium">{defaultTable}</span>

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
                  typeof options[number]
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

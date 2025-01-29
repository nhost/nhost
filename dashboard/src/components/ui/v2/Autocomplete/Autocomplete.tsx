import { Chip } from '@/components/ui/v2/Chip';
import type { FormControlProps } from '@/components/ui/v2/FormControl';
import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { ChevronDownIcon } from '@/components/ui/v2/icons/ChevronDownIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import type { InputProps } from '@/components/ui/v2/Input';
import { Input, inputClasses } from '@/components/ui/v2/Input';
import { OptionBase } from '@/components/ui/v2/Option';
import { OptionGroupBase } from '@/components/ui/v2/OptionGroup';
import type { StyledComponent } from '@emotion/styled';
import { Popper } from '@mui/base';
import type { UseAutocompleteProps } from '@mui/base/useAutocomplete';
import { createFilterOptions } from '@mui/base/useAutocomplete';
import { styled } from '@mui/material';
import type { AutocompleteProps as MaterialAutocompleteProps } from '@mui/material/Autocomplete';
import MaterialAutocomplete, {
  autocompleteClasses as materialAutocompleteClasses,
} from '@mui/material/Autocomplete';
import clsx from 'clsx';
import type { ForwardedRef } from 'react';
import { forwardRef, useEffect, useRef, useState } from 'react';

export interface AutocompleteOption<TValue = string> {
  /**
   * Label to display.
   */
  label: string;
  /**
   * Label to display in the dropdown.
   */
  dropdownLabel?: string;
  /**
   * Value to be submitted.
   */
  value: TValue;
  /**
   * Determines whether the option is custom.
   */
  custom?: boolean;
  /**
   * Value that can be used to group options.
   */
  group?: string;
  /**
   * Any additional data to be passed to the option.
   */
  metadata?: any;
}

export interface AutocompleteProps<
  TOption extends AutocompleteOption = AutocompleteOption,
> extends Omit<
      MaterialAutocompleteProps<TOption, boolean, boolean, boolean>,
      'renderInput' | 'autoSelect' | 'componentsProps'
    >,
    Pick<
      InputProps,
      | 'fullWidth'
      | 'placeholder'
      | 'label'
      | 'helperText'
      | 'hideEmptyHelperText'
      | 'error'
      | 'variant'
      | 'className'
    > {
  /**
   * Props for component slots.
   */
  slotProps?: MaterialAutocompleteProps<
    TOption,
    boolean,
    boolean,
    boolean
  >['componentsProps'] & {
    /**
     * Props passed to the root element.
     */
    root?: Partial<UseAutocompleteProps<any, boolean, boolean, boolean>>;
    /**
     * Props passed to the input component.
     */
    input?: Partial<Omit<InputProps, 'ref'>>;
    /**
     * Props passed to the input's `FormControl` component.
     */
    formControl?: Partial<FormControlProps>;
  };
  /**
   * Name of the input field.
   */
  name?: string;
  /**
   * Function to be used to conditionally decide if the highlighted option
   * should automatically be selected on blur.
   */
  autoSelect?: boolean | ((filteredOptions?: AutocompleteOption[]) => boolean);
  /**
   * Show custom option at the end of filtered options.
   *
   * @default 'never'
   */
  showCustomOption?: 'always' | 'never' | 'auto';
  /**
   * Custom option label.
   */
  customOptionLabel?: string | ((customOptionLabel: string) => string);
}

const StyledTag = styled(Chip)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(15),
  lineHeight: theme.typography.pxToRem(22),
  color: theme.palette.text.primary,
  fontWeight: 400,
}));

const StyledAutocomplete = styled(MaterialAutocomplete)(({ theme }) => ({
  [`&:not(.${materialAutocompleteClasses.focused})`]: {
    [`& .${inputClasses.root}`]: {
      maxHeight: 40,
      overflow: 'auto',
    },
  },
  [`.${materialAutocompleteClasses.endAdornment}`]: {
    right: theme.spacing(1.5),
  },
  [`.${materialAutocompleteClasses.input}`]: {
    paddingRight: theme.spacing(3),
  },
  [`.${materialAutocompleteClasses.endAdornment} .${materialAutocompleteClasses.popupIndicator}`]:
    {
      color: theme.palette.text.secondary,
    },
})) as any as StyledComponent<
  MaterialAutocompleteProps<AutocompleteOption, boolean, boolean, boolean>
>;

const StyledOptionBase = styled(OptionBase)(({ theme }) => ({
  display: 'grid !important',
  gridAutoFlow: 'column',
  justifyContent: 'space-between !important',
  gap: theme.spacing(0.5),
}));

export const AutocompletePopper = styled(Popper)(({ theme }) => ({
  zIndex: theme.zIndex.modal + 1,
  boxShadow: 'none',
  minWidth: 320,
  maxWidth: 600,
  [`& .${materialAutocompleteClasses.paper}`]: {
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.secondary[100]
        : theme.palette.common.white,
    borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
    borderColor:
      theme.palette.mode === 'dark' ? theme.palette.grey[400] : 'none',
    boxShadow: `0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)`,
  },
  [`& .${materialAutocompleteClasses.listbox}`]: {
    overflow: 'auto',
    minWidth: 320,
    maxWidth: 600,
    maxHeight: 400,
    margin: 0,
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.secondary[100]
        : theme.palette.common.white,
    padding: 0,
    [`& .${materialAutocompleteClasses.option}`]: {
      padding: theme.spacing(1, 1.5),
      cursor: 'default',
      minHeight: 'initial',
    },
  },
  [`& .${materialAutocompleteClasses.noOptions}`]: {
    padding: theme.spacing(1, 1.5),
    fontSize: '0.875rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
}));

/**
 * Function to be used to filter options.
 */
export const filterOptions = createFilterOptions<AutocompleteOption>({
  matchFrom: 'any',
  ignoreAccents: true,
  ignoreCase: true,
  trim: true,
  stringify: (option) => `${option.label} (${option.value})`,
});

function Autocomplete(
  {
    slotProps = {},
    fullWidth,
    placeholder,
    label,
    variant,
    helperText,
    hideEmptyHelperText,
    error,
    name,
    inputValue: externalInputValue,
    onInputChange,
    filterOptions: externalFilterOptions,
    autoSelect: externalAutoSelect,
    customOptionLabel: externalCustomOptionLabel,
    showCustomOption = 'never',
    'aria-label': ariaLabel,
    ...props
  }: AutocompleteProps<AutocompleteOption>,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const inputRef = useRef<HTMLInputElement>();
  const { formControl: formControlSlotProps, ...defaultComponentsProps } =
    slotProps || {};

  const [inputValue, setInputValue] = useState<string>(
    () => externalInputValue || '',
  );

  // TODO: Revisit this implementation. We should probably have a better way to
  // make this component controlled.
  useEffect(() => {
    setInputValue(externalInputValue);
  }, [externalInputValue]);

  const filterOptionsFn = externalFilterOptions || filterOptions;
  const filteredOptions = filterOptionsFn(
    props.options as AutocompleteOption[],
    {
      inputValue: inputValue || '',
      getOptionLabel: props.getOptionLabel
        ? props.getOptionLabel
        : (option: string | number | AutocompleteOption<string>) => {
            if (typeof option !== 'object') {
              return option.toString();
            }

            return option.label ?? option.dropdownLabel;
          },
    },
  );

  const autoSelect =
    typeof externalAutoSelect === 'function'
      ? externalAutoSelect(filteredOptions)
      : externalAutoSelect;

  const customOptionLabel =
    typeof externalCustomOptionLabel === 'function'
      ? externalCustomOptionLabel(inputValue)
      : externalCustomOptionLabel;

  return (
    <StyledAutocomplete
      ref={ref}
      openOnFocus
      disablePortal
      disableClearable
      componentsProps={{
        ...defaultComponentsProps,
        popper: {
          modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
          ...defaultComponentsProps.popper,
          placement: 'bottom-start',
        },
        popupIndicator: {
          ...defaultComponentsProps?.popupIndicator,
          disableRipple: true,
          className: clsx(
            materialAutocompleteClasses.popupIndicator,
            defaultComponentsProps?.popupIndicator?.className,
          ),
        },
      }}
      inputValue={inputValue || ''}
      onInputChange={(event, value, reason) => {
        setInputValue(value);

        if (onInputChange) {
          onInputChange(event, value, reason);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }

        event.stopPropagation();

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }}
      PopperComponent={AutocompletePopper}
      popupIcon={<ChevronDownIcon sx={{ width: 12, height: 12 }} />}
      getOptionLabel={(
        option: string | number | AutocompleteOption<string>,
      ) => {
        if (!option) {
          return '';
        }

        if (typeof option !== 'object') {
          return option.toString();
        }

        return option.label ?? option.dropdownLabel;
      }}
      isOptionEqualToValue={(
        option,
        value: string | number | AutocompleteOption<string>,
      ) => {
        if (!value) {
          return false;
        }

        if (typeof value !== 'object') {
          return option.value.toString() === value.toString();
        }

        return option.value === value.value && option.custom === value.custom;
      }}
      renderTags={(value, getTagProps) =>
        value.map(
          (option: string | number | AutocompleteOption<string>, index) => (
            <StyledTag
              deleteIcon={<XIcon />}
              size="small"
              sx={{ fontSize: (theme) => theme.typography.pxToRem(12) }}
              label={
                typeof option !== 'object' ? option.toString() : option.value
              }
              {...getTagProps({ index })}
            />
          ),
        )
      }
      renderGroup={({ group, key, children }) =>
        group ? (
          <div key={key}>
            <OptionGroupBase>{group}</OptionGroupBase>

            {children}
          </div>
        ) : (
          <div key={key}>{children}</div>
        )
      }
      renderOption={(
        optionProps,
        option: string | number | AutocompleteOption<string>,
      ) => {
        const selected = optionProps['aria-selected'];

        if (typeof option !== 'object') {
          return (
            <StyledOptionBase {...optionProps} key={option.toString()}>
              {option.toString()}
              {selected && props.multiple && (
                <CheckIcon sx={{ width: 16, height: 16 }} />
              )}
            </StyledOptionBase>
          );
        }

        return (
          <StyledOptionBase
            {...optionProps}
            key={option.dropdownLabel || option.label}
          >
            <>
              <span>{option.dropdownLabel || option.label}</span>

              {selected && props.multiple && (
                <CheckIcon key="asd" sx={{ width: 16, height: 16 }} />
              )}
            </>
          </StyledOptionBase>
        );
      }}
      filterOptions={
        showCustomOption !== 'never'
          ? () => {
              if (!inputValue) {
                return filteredOptions;
              }

              if (showCustomOption === 'auto') {
                const isInputValueInOptions = filteredOptions.some(
                  (filteredOption) => filteredOption.label === inputValue,
                );

                return isInputValueInOptions
                  ? filteredOptions
                  : [
                      ...filteredOptions,
                      {
                        value: inputValue,
                        label: inputValue,
                        dropdownLabel:
                          customOptionLabel || `Select "${inputValue}"`,
                        custom: Boolean(inputValue),
                      },
                    ];
              }

              return [
                ...filteredOptions,
                {
                  value: inputValue,
                  label: inputValue,
                  dropdownLabel: customOptionLabel || `Select "${inputValue}"`,
                  custom: Boolean(inputValue),
                },
              ];
            }
          : filterOptionsFn
      }
      autoSelect={autoSelect}
      renderInput={({
        InputProps: InternalInputProps,
        InputLabelProps,
        ...params
      }) => (
        <Input
          ref={inputRef}
          slotProps={{
            input: {
              className: slotProps?.input?.className,
              sx: props.multiple
                ? {
                    flexWrap: 'wrap',
                    [`& .${inputClasses.input}`]: {
                      minWidth: 30,
                      width: 0,
                    },
                  }
                : null,
            },
            inputRoot: { 'aria-label': ariaLabel },
            label: InputLabelProps,
            formControl: formControlSlotProps,
          }}
          {...InternalInputProps}
          {...params}
          {...slotProps?.input}
          value={params?.inputProps?.value || ''}
          // prevent className changes from the Autocomplete component
          className={slotProps?.input?.className || ''}
          autoComplete="off"
          fullWidth={fullWidth}
          placeholder={placeholder}
          label={label}
          variant={variant}
          helperText={helperText}
          hideEmptyHelperText={hideEmptyHelperText}
          error={error}
          name={name}
        />
      )}
      {...props}
    />
  );
}

Autocomplete.displayName = 'NhostAutocomplete';

export default forwardRef(Autocomplete);

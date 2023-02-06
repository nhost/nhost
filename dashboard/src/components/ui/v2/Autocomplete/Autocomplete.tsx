import Chip from '@/ui/v2/Chip';
import type { FormControlProps } from '@/ui/v2/FormControl';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import XIcon from '@/ui/v2/icons/XIcon';
import type { InputProps } from '@/ui/v2/Input';
import Input, { inputClasses } from '@/ui/v2/Input';
import { OptionBase } from '@/ui/v2/Option';
import { OptionGroupBase } from '@/ui/v2/OptionGroup';
import type { StyledComponent } from '@emotion/styled';
import type { UseAutocompleteProps } from '@mui/base/AutocompleteUnstyled';
import { createFilterOptions } from '@mui/base/AutocompleteUnstyled';
import PopperUnstyled from '@mui/base/PopperUnstyled';
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
   */
  showCustomOption?: boolean;
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

export const AutocompletePopper = styled(PopperUnstyled)(({ theme }) => ({
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

const filterOptions = createFilterOptions<AutocompleteOption>({
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
    showCustomOption,
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

  const filteredOptions = filterOptions(props.options as AutocompleteOption[], {
    inputValue: inputValue || '',
    getOptionLabel: props.getOptionLabel
      ? props.getOptionLabel
      : (option) => {
          if (typeof option === 'string') {
            return option;
          }

          return option.label ?? option.dropdownLabel;
        },
  });

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
      getOptionLabel={(option) => {
        if (typeof option === 'string') {
          return option;
        }

        return option.label ?? option.dropdownLabel;
      }}
      isOptionEqualToValue={(option, value) => {
        if (!value) {
          return false;
        }

        if (typeof value === 'string') {
          return option.value === value;
        }

        return option.value === value.value && option.custom === value.custom;
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <StyledTag
            deleteIcon={<XIcon />}
            size="small"
            label={typeof option === 'string' ? option : option.value}
            {...getTagProps({ index })}
          />
        ))
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
      renderOption={(optionProps, option) => {
        if (typeof option === 'string') {
          return <OptionBase {...optionProps}>{option}</OptionBase>;
        }

        return (
          <OptionBase
            {...optionProps}
            key={option.dropdownLabel || option.label}
          >
            {option.dropdownLabel || option.label}
          </OptionBase>
        );
      }}
      filterOptions={
        showCustomOption
          ? () => {
              if (inputValue) {
                return [
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

              return filteredOptions;
            }
          : externalFilterOptions || filterOptions
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

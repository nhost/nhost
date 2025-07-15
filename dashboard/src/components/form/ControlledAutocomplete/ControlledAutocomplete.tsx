import type {
  AutocompleteOption,
  AutocompleteProps,
} from '@/components/ui/v2/Autocomplete';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { isNotEmptyValue } from '@/lib/utils';
import { callAll } from '@/utils/callAll';
import type { FilterOptionsState } from '@mui/material';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { FieldValues, UseControllerProps } from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';

export interface ControlledAutocompleteProps<
  TOption extends AutocompleteOption = AutocompleteOption,
  TFieldValues extends FieldValues = any,
> extends AutocompleteProps<TOption> {
  /**
   * Props passed to the react-hook-form controller.
   */
  controllerProps?: UseControllerProps<TFieldValues>;
  /**
   * Name of the input field.
   */
  name?: string;
  /**
   * Control for the input field.
   */
  control?: UseControllerProps<TFieldValues>['control'];
}

export function defaultFilterOptions(
  options: AutocompleteOption<string>[],
  { inputValue }: FilterOptionsState<AutocompleteOption<string>>,
) {
  const inputValueLower = inputValue.toLowerCase();
  const matched: AutocompleteOption<string>[] = [];
  const otherOptions: AutocompleteOption<string>[] = [];

  options.forEach((option) => {
    const optionLabelLower = option.label.toLowerCase();

    if (optionLabelLower.startsWith(inputValueLower)) {
      matched.push(option);
    } else {
      otherOptions.push(option);
    }
  });

  const result = [...matched, ...otherOptions];

  return result;
}

function ControlledAutocomplete(
  {
    controllerProps,
    name,
    control,
    ...props
  }: ControlledAutocompleteProps<AutocompleteOption>,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const form = useFormContext();
  const nameAttr = controllerProps?.name || name || '';
  const { field } = useController({
    ...(controllerProps || {}),
    name: nameAttr,
    control: controllerProps?.control || control,
  });

  if (!form) {
    throw new Error('ControlledAutocomplete must be used in a FormContext.');
  }

  const { setValue } = form || {};

  return (
    <Autocomplete
      inputValue={
        typeof field.value !== 'object' && isNotEmptyValue(field.value)
          ? field.value.toString()
          : undefined
      }
      {...props}
      {...field}
      ref={mergeRefs([field.ref, ref])}
      onChange={(event, options, reason, details) => {
        setValue?.(nameAttr, options, {
          shouldDirty: true,
        });

        if (props.onChange) {
          props.onChange(event, options, reason, details);
        }
      }}
      onBlur={callAll<[React.FocusEvent<HTMLDivElement>]>(
        field.onBlur,
        props.onBlur,
      )}
    />
  );
}

export default forwardRef(ControlledAutocomplete);

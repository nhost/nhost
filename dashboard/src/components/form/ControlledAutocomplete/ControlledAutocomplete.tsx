import type {
  AutocompleteOption,
  AutocompleteProps,
} from '@/components/ui/v2/Autocomplete';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { callAll } from '@/utils/callAll';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { FieldValues, UseControllerProps } from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import mergeRefs from 'react-merge-refs';

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
  const { field } = useController({
    ...(controllerProps || {}),
    name: controllerProps?.name || name || '',
    control: controllerProps?.control || control,
  });

  if (!form) {
    throw new Error('ControlledAutocomplete must be used in a FormContext.');
  }

  const { setValue } = form || {};

  return (
    <Autocomplete
      inputValue={
        typeof field.value !== 'object' ? field.value.toString() : undefined
      }
      {...props}
      {...field}
      ref={mergeRefs([field.ref, ref])}
      onChange={(event, options, reason, details) => {
        setValue?.(controllerProps?.name || name, options, {
          shouldDirty: true,
        });

        if (props.onChange) {
          props.onChange(event, options, reason, details);
        }
      }}
      onBlur={callAll(field.onBlur, props.onBlur)}
    />
  );
}

export default forwardRef(ControlledAutocomplete);

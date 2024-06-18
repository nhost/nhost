import type { SelectProps } from '@/components/ui/v2/Select';
import { Select } from '@/components/ui/v2/Select';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { FieldValues, UseControllerProps } from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import mergeRefs from 'react-merge-refs';

export interface ControlledSelectProps<TFieldValues extends FieldValues = any>
  extends SelectProps<TFieldValues> {
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

function ControlledSelect(
  { controllerProps, name, control, ...props }: ControlledSelectProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const { setValue } = useFormContext();
  const { field } = useController({
    ...controllerProps,
    name: controllerProps?.name || name || '',
    control: controllerProps?.control || control,
  });

  return (
    <Select
      {...props}
      {...field}
      ref={mergeRefs([field.ref, ref])}
      onChange={(event, value) => {
        setValue(controllerProps?.name || name, value, { shouldDirty: true });

        if (props.onChange) {
          props.onChange(event, value);
        }
      }}
    />
  );
}

export default forwardRef(ControlledSelect);

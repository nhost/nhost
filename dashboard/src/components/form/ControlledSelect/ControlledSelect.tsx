import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { FieldValues, UseControllerProps } from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import type { SelectProps } from '@/components/ui/v2/Select';
import { Select } from '@/components/ui/v2/Select';

// biome-ignore lint/suspicious/noExplicitAny: TODO
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

export default forwardRef(
  (
    { controllerProps, name, control, ...props }: ControlledSelectProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    const { setValue } = useFormContext();
    const nameAttr = controllerProps?.name || name || '';
    const { field } = useController({
      ...controllerProps,
      name: nameAttr,
      control: controllerProps?.control || control,
    });

    return (
      <Select
        {...props}
        {...field}
        ref={mergeRefs([field.ref, ref])}
        onChange={(event, value) => {
          setValue(nameAttr, value, { shouldDirty: true });

          if (props.onChange) {
            props.onChange(event, value);
          }
        }}
      />
    );
  },
);

import type { CheckboxProps } from '@/components/ui/v2/Checkbox';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { callAll } from '@/utils/callAll';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { FieldValues, UseControllerProps } from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import mergeRefs from 'react-merge-refs';

export interface ControlledCheckboxProps<TFieldValues extends FieldValues = any>
  extends CheckboxProps {
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
  /**
   * Determines whether or not the checkbox should be unchecked when the input
   * is disabled.
   *
   * @default false
   */
  uncheckWhenDisabled?: boolean;
}

function ControlledCheckbox(
  {
    controllerProps,
    name,
    control,
    uncheckWhenDisabled,
    ...props
  }: ControlledCheckboxProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const { setValue } = useFormContext();
  const { field } = useController({
    ...controllerProps,
    name: controllerProps?.name || name || '',
    control: controllerProps?.control || control,
  });

  return (
    <Checkbox
      {...props}
      name={field.name}
      ref={mergeRefs([field.ref, ref])}
      onChange={(event, checked) => {
        setValue(controllerProps?.name || name, checked, { shouldDirty: true });

        if (props.onChange) {
          props.onChange(event, checked);
        }
      }}
      onBlur={callAll(field.onBlur, props.onBlur)}
      checked={uncheckWhenDisabled && props.disabled ? false : field.value}
    />
  );
}

export default forwardRef(ControlledCheckbox);

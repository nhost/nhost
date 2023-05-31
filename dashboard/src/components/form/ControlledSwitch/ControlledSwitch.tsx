import type { SwitchProps } from '@/components/ui/v2/Switch';
import { Switch } from '@/components/ui/v2/Switch';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import type {
  ControllerProps,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form/dist/types';
import mergeRefs from 'react-merge-refs';

export interface ControlledSwitchProps<TFieldValues extends FieldValues = any>
  extends SwitchProps {
  /**
   * Props passed to the react-hook-form controller.
   */
  controllerProps?: ControllerProps;
  /**
   * Name of the field.
   */
  name?: string;
  /**
   * Control for the input field.
   */
  control?: UseControllerProps<TFieldValues>['control'];
}

function ControlledSwitch(
  { controllerProps, name, control, ...props }: ControlledSwitchProps,
  ref: ForwardedRef<HTMLSpanElement>,
) {
  const { setValue } = useFormContext();
  const { field } = useController({
    ...controllerProps,
    name: controllerProps?.name || name || '',
    control: controllerProps?.control || control,
  });

  return (
    <Switch
      {...props}
      {...field}
      ref={mergeRefs([field.ref, ref])}
      onChange={(event) => {
        setValue(controllerProps?.name || name, event.target.checked, {
          shouldDirty: true,
        });

        if (props.onChange) {
          props.onChange(event);
        }
      }}
      checked={field.value || false}
    />
  );
}

export default forwardRef(ControlledSwitch);

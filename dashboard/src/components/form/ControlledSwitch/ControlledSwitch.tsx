import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type {
  ControllerProps,
  FieldValues,
  UseControllerProps,
} from 'react-hook-form';
import { useController, useFormContext } from 'react-hook-form';
import { mergeRefs } from 'react-merge-refs';
import type { SwitchProps } from '@/components/ui/v2/Switch';
import { Switch } from '@/components/ui/v2/Switch';

// biome-ignore lint/suspicious/noExplicitAny: TODO
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

export default forwardRef(
  (
    { controllerProps, name, control, ...props }: ControlledSwitchProps,
    ref: ForwardedRef<HTMLSpanElement>,
  ) => {
    const { setValue } = useFormContext();
    const nameAttr = controllerProps?.name || name || '';
    const { field } = useController({
      ...controllerProps,
      name: nameAttr,
      control: controllerProps?.control || control,
    });

    return (
      <Switch
        {...props}
        {...field}
        ref={mergeRefs([field.ref, ref])}
        onChange={(event) => {
          setValue(nameAttr, event.target.checked, {
            shouldDirty: true,
          });

          if (props.onChange) {
            props.onChange(event);
          }
        }}
        checked={field.value || false}
      />
    );
  },
);

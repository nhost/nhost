import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import type { DialogFormProps } from '@/types/common';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export interface BasePermissionVariableFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BasePermissionVariableFormValues) => void;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
}

export const basePermissionVariableValidationSchema = Yup.object({
  key: Yup.string().label('Field Name').nullable().required(),
  value: Yup.string().label('Path').nullable().required(),
});

export type BasePermissionVariableFormValues = Yup.InferType<
  typeof basePermissionVariableValidationSchema
>;

export default function BasePermissionVariableForm({
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BasePermissionVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BasePermissionVariableFormValues>();

  const {
    register,
    formState: { dirtyFields, errors, isSubmitting },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <div className="grid grid-flow-row gap-2 px-6 pb-6">
      <Text variant="subtitle1" component="span">
        Enter the field name and the path you want to use in this permission
        variable.
      </Text>

      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        <Input
          {...register('key', {
            onChange: (event) => {
              if (
                event.target.value &&
                !/^[a-zA-Z-]+$/gi.test(event.target.value)
              ) {
                // we need to prevent invalid characters from being entered
                // eslint-disable-next-line no-param-reassign
                event.target.value = event.target.value.replace(
                  /[^a-zA-Z-]/gi,
                  '',
                );
              }
            },
          })}
          id="key"
          label="Field Name"
          hideEmptyHelperText
          error={!!errors.key}
          helperText={errors?.key?.message}
          fullWidth
          autoComplete="off"
          autoFocus
          slotProps={{ inputRoot: { className: '!pl-px' } }}
          startAdornment={
            <Text className="shrink-0 pl-2" color="disabled">
              X-Hasura-
            </Text>
          }
        />

        <Input
          {...register('value', {
            onChange: (event) => {
              if (
                event.target.value &&
                !/^[a-zA-Z-_.[\]]+$/gi.test(event.target.value)
              ) {
                // we need to prevent invalid characters from being entered
                // eslint-disable-next-line no-param-reassign
                event.target.value = event.target.value.replace(
                  /[^a-zA-Z-.[\]]/gi,
                  '',
                );
              }
            },
          })}
          id="value"
          label="Path"
          hideEmptyHelperText
          error={!!errors.value}
          helperText={errors?.value?.message}
          fullWidth
          autoComplete="off"
          slotProps={{ inputRoot: { className: '!pl-px' } }}
          startAdornment={
            <Text className="shrink-0 pl-2" color="disabled">
              user.
            </Text>
          }
        />

        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting}>
            {submitButtonText}
          </Button>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}

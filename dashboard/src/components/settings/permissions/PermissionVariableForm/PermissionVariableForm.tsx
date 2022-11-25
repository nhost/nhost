import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { CustomClaim } from '@/types/application';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface PermissionVariableFormValues {
  /**
   * Permission variable key.
   */
  key: string;
  /**
   * Permission variable value.
   */
  value: string;
}

export interface PermissionVariableFormProps {
  /**
   * List of available permission variables.
   */
  availableVariables: CustomClaim[];
  /**
   * Original permission variable. This is defined only if the form was
   * opened to edit an existing permission variable.
   */
  originalVariable?: CustomClaim;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: PermissionVariableFormValues) => void;
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

const validationSchema = Yup.object({
  key: Yup.string().required('This field is required.'),
  value: Yup.string().required('This field is required.'),
});

export default function PermissionVariableForm({
  availableVariables,
  originalVariable,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: PermissionVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useForm<PermissionVariableFormValues>({
    defaultValues: {
      key: originalVariable?.key || '',
      value: originalVariable?.value || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    setError,
    formState: { dirtyFields, errors, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  async function handleSubmit(values: PermissionVariableFormValues) {
    if (
      availableVariables.some(
        (variable) =>
          variable.key === values.key && variable.key !== originalVariable?.key,
      )
    ) {
      setError('key', { message: 'This key is already in use.' });

      return;
    }

    onSubmit?.(values);
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
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
          slotProps={{ input: { className: '!pl-px' } }}
          startAdornment={
            <Text className="shrink-0 pl-2 text-greyscaleGrey">X-Hasura-</Text>
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
          slotProps={{ input: { className: '!pl-px' } }}
          startAdornment={
            <Text className="shrink-0 pl-2 text-greyscaleGrey">user.</Text>
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
    </FormProvider>
  );
}

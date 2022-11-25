import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { EnvironmentVariable } from '@/types/application';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface EnvironmentVariableFormValues {
  /**
   * Identifier of the environment variable.
   */
  id: string;
  /**
   * The name of the role.
   */
  name: string;
  /**
   * Development environment variable value.
   */
  devValue: string;
  /**
   * Production environment variable value.
   */
  prodValue: string;
}

export interface EnvironmentVariableFormProps {
  /**
   * Available environment variables.
   */
  availableEnvironmentVariables: EnvironmentVariable[];
  /**
   * Original environment variable. This is defined only if the form was opened
   * to edit an existing environment variable.
   */
  originalEnvironmentVariable?: EnvironmentVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: EnvironmentVariableFormValues) => void;
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
  name: Yup.string().required('This field is required.'),
  devValue: Yup.string().required('This field is required.'),
  prodValue: Yup.string().required('This field is required.'),
});

export default function EnvironmentVariableForm({
  availableEnvironmentVariables,
  originalEnvironmentVariable,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: EnvironmentVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useForm<EnvironmentVariableFormValues>({
    defaultValues: {
      id: originalEnvironmentVariable?.id || '',
      name: originalEnvironmentVariable?.name || '',
      devValue: originalEnvironmentVariable?.devValue || '',
      prodValue: originalEnvironmentVariable?.prodValue || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  async function handleSubmit(values: EnvironmentVariableFormValues) {
    if (
      availableEnvironmentVariables?.some((role) => role.name === values.name)
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

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
          {...register('name')}
          inputProps={{ maxLength: 100 }}
          id="name"
          label="Name"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.name}
          helperText={errors?.name?.message}
          fullWidth
          autoComplete="off"
        />

        <Input
          {...register('prodValue')}
          inputProps={{ maxLength: 100 }}
          id="prodValue"
          label="Production Value"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.prodValue}
          helperText={errors?.prodValue?.message}
          fullWidth
          autoComplete="off"
        />

        <Input
          {...register('devValue')}
          inputProps={{ maxLength: 100 }}
          id="devValue"
          label="Development Value"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.devValue}
          helperText={errors?.devValue?.message}
          fullWidth
          autoComplete="off"
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

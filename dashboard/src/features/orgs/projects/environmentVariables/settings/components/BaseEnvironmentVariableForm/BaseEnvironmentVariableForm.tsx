import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import type { DialogFormProps } from '@/types/common';

export interface BaseEnvironmentVariableFormProps extends DialogFormProps {
  /**
   * Determines the mode of the form.
   *
   * @default 'edit'
   */
  mode?: 'edit' | 'create';
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseEnvironmentVariableFormValues) => void;
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

export const baseEnvironmentVariableFormValidationSchema = Yup.object({
  id: Yup.string().label('ID'),
  name: Yup.string()
    .label('Name')
    .nullable()
    .required()
    .test(
      'isEnvVarPermitted',
      'This is a reserved name.',
      (value) =>
        ![
          'PATH',
          'NODE_PATH',
          'PYTHONPATH',
          'GEM_PATH',
          'HOSTNAME',
          'TERM',
          'NODE_VERSION',
          'YARN_VERSION',
          'HOME',
        ].includes(value),
    )
    .test(
      'isEnvVarPrefixPermitted',
      `The name can't start with NHOST_, HASURA_, AUTH_, STORAGE_ or POSTGRES_.`,
      (value) =>
        ['NHOST_', 'HASURA_', 'AUTH_', 'STORAGE_', 'POSTGRES_'].every(
          (prefix) => !value.startsWith(prefix),
        ),
    )
    .test(
      'isEnvVarValid',
      'A name must start with a letter and can only contain letters, numbers, and underscores.',
      (value) => /^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/i.test(value),
    ),
  value: Yup.string().label('Value'),
});

export type BaseEnvironmentVariableFormValues = Yup.InferType<
  typeof baseEnvironmentVariableFormValidationSchema
>;

export default function BaseEnvironmentVariableForm({
  mode = 'edit',
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BaseEnvironmentVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BaseEnvironmentVariableFormValues>();

  const {
    control,
    formState: { dirtyFields, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <p className="text-muted-foreground text-sm">
        Environment Variables are made available to all your services. All
        values are encrypted.
      </p>

      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        <FormInput
          control={control}
          name="name"
          label="Name"
          placeholder="EXAMPLE_NAME"
          autoComplete="off"
          disabled={mode === 'edit'}
        />

        <FormTextarea
          control={control}
          name="value"
          label="Value"
          placeholder="Enter value"
          className="min-h-32"
        />

        <div className="grid grid-flow-row gap-2">
          <ButtonWithLoading type="submit" loading={isSubmitting}>
            {submitButtonText}
          </ButtonWithLoading>

          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}

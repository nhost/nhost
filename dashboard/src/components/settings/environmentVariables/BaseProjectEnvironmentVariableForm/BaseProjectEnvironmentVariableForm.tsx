import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export interface BaseProjectEnvironmentVariableFormValues {
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

export interface BaseProjectEnvironmentVariableFormProps {
  /**
   * Determines whether or not name should be disabled.
   */
  disableName?: boolean;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseProjectEnvironmentVariableFormValues) => void;
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

export const baseProjectEnvironmentVariableFormValidationSchema = Yup.object({
  name: Yup.string()
    .required('This field is required.')
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
          'NODE_ENV',
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
    .test('isEnvVarValid', `The name must start with a letter.`, (value) =>
      /^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/i.test(value),
    ),
  devValue: Yup.string().required('This field is required.'),
  prodValue: Yup.string().required('This field is required.'),
});

export default function BaseProjectEnvironmentVariableForm({
  disableName,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: BaseProjectEnvironmentVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BaseProjectEnvironmentVariableFormValues>();

  const {
    register,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  return (
    <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4 px-6 pb-6">
      <Input
        {...register('name', {
          onChange: (event) => {
            if (
              event.target.value &&
              !/^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/g.test(event.target.value)
            ) {
              // we need to prevent invalid characters from being entered
              // eslint-disable-next-line no-param-reassign
              event.target.value = event.target.value
                .replace(/[^a-zA-Z0-9_]/g, '')
                .toUpperCase();
            } else {
              // we want to transform the value to uppercase
              // eslint-disable-next-line no-param-reassign
              event.target.value = event.target.value?.toUpperCase() || '';
            }
          },
        })}
        inputProps={{ maxLength: 100 }}
        id="name"
        label="Name"
        placeholder="EXAMPLE_NAME"
        hideEmptyHelperText
        error={!!errors.name}
        helperText={errors?.name?.message}
        fullWidth
        autoComplete="off"
        disabled={disableName}
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
  );
}

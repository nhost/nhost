import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export interface BaseEnvironmentVariableFormValues {
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

export interface BaseEnvironmentVariableFormProps {
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

export default function BaseEnvironmentVariableForm({
  mode = 'edit',
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: BaseEnvironmentVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BaseEnvironmentVariableFormValues>();

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
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      <Text variant="subtitle1" component="span">
        Environment Variables are made available to all your services. All
        values are encrypted.
      </Text>

      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        <Input
          {...register('name', {
            onChange: (event) => {
              if (
                event.target.value &&
                !/^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/g.test(event.target.value)
              ) {
                // we need to prevent invalid characters from being entered
                // eslint-disable-next-line no-param-reassign
                event.target.value = event.target.value.replace(
                  /[^a-zA-Z0-9_]/g,
                  '',
                );
              }
            },
          })}
          id="name"
          label="Name"
          placeholder="EXAMPLE_NAME"
          hideEmptyHelperText
          error={!!errors.name}
          helperText={errors?.name?.message}
          fullWidth
          autoComplete="off"
          autoFocus={mode === 'create'}
          disabled={mode === 'edit'}
        />

        <Input
          {...register('prodValue')}
          id="prodValue"
          label="Production Value"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.prodValue}
          helperText={errors?.prodValue?.message}
          fullWidth
          autoComplete="off"
          autoFocus={mode === 'edit'}
        />

        <Input
          {...register('devValue')}
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
    </div>
  );
}

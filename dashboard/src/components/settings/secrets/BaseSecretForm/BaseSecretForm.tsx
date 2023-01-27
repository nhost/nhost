import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export interface BaseSecretFormValues {
  /**
   * Identifier of the environment variable.
   */
  id: string;
  /**
   * The name of the role.
   */
  name: string;
  /**
   * Value of the secret.
   */
  value: string;
}

export interface BaseSecretFormProps {
  /**
   * Determines the mode of the form.
   *
   * @default 'edit'
   */
  mode?: 'edit' | 'create';
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseSecretFormValues) => void;
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

export const BaseSecretFormValidationSchema = Yup.object({
  name: Yup.string()
    .required('This field is required.')
    .test('isEnvVarValid', `The name must start with a letter.`, (value) =>
      /^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/i.test(value),
    ),
  value: Yup.string().required('This field is required.'),
});

export default function BaseSecretForm({
  mode = 'edit',
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: BaseSecretFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BaseSecretFormValues>();

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
          {...register('value')}
          id="value"
          label="Value"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.value}
          helperText={errors?.value?.message}
          fullWidth
          multiline
          rows={5}
          autoComplete="off"
          autoFocus={mode === 'edit'}
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

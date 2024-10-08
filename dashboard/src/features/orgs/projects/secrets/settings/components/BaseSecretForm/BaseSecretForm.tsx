import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

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

export const baseSecretFormValidationSchema = Yup.object({
  name: Yup.string()
    .label('Name')
    .required('This field is required.')
    .test(
      'isSecretValid',
      'A name must start with a letter and can only contain letters, numbers, and underscores.',
      (value) => /^[a-zA-Z]{1,}[a-zA-Z0-9_]*$/i.test(value),
    ),
  value: Yup.string().label('Value'),
});

export type BaseSecretFormValues = Yup.InferType<
  typeof baseSecretFormValidationSchema
>;

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
          {...register('name')}
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

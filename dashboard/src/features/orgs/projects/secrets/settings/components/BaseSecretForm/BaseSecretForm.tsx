import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import type { MakeRequired } from '@/types/common';

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
  onSubmit: (values: MakeRequired<BaseSecretFormValues, 'value'>) => void;
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
  // An empty or blank value would wipe the secret, so it can't be saved.
  value: Yup.string()
    .label('Value')
    .required('Enter a value.')
    .test('notBlank', 'Enter a value.', (value) => Boolean(value?.trim())),
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
    control,
    setFocus,
    formState: { dirtyFields, isSubmitting },
  } = form;

  const value = useWatch({ control, name: 'value' });
  const hasValue = Boolean(value?.trim());

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    setFocus(mode === 'create' ? 'name' : 'value');
  }, [mode, setFocus]);

  return (
    <div className="grid grid-flow-row gap-6 px-12 pb-12">
      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        {/* A secret can't be read back, so editing only replaces its value.
            Its name can't change: the configuration refers to it by name. */}
        {mode === 'edit' ? (
          <p className="text-muted-foreground text-sm">
            The current value is hidden. Saving replaces it.
          </p>
        ) : (
          <FormInput
            control={control}
            name="name"
            label="Name"
            placeholder="EXAMPLE_NAME"
            autoComplete="off"
          />
        )}

        <FormTextarea
          control={control}
          name="value"
          label={mode === 'edit' ? 'New value' : 'Value'}
          placeholder={mode === 'edit' ? 'Enter a new value' : 'Enter value'}
          className="min-h-32"
        />

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <ButtonWithLoading
            type="submit"
            loading={isSubmitting}
            disabled={!hasValue}
          >
            {submitButtonText}
          </ButtonWithLoading>
        </div>
      </Form>
    </div>
  );
}

import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { DialogFooter } from '@/components/ui/v3/dialog';
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
  /**
   * Called whenever the form's dirty state changes, so the surrounding
   * `AppDialog` can warn before discarding unsaved changes.
   */
  onDirtyStateChange?: (isDirty: boolean) => void;
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
  onDirtyStateChange,
}: BaseSecretFormProps) {
  const form = useFormContext<BaseSecretFormValues>();

  const {
    control,
    setFocus,
    formState: { dirtyFields, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  useEffect(() => {
    setFocus(mode === 'create' ? 'name' : 'value');
  }, [mode, setFocus]);

  return (
    <div className="grid grid-flow-row gap-6">
      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-8">
        <div className="grid grid-flow-row gap-4">
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline-emboss" onClick={onCancel}>
            Cancel
          </Button>
          <ButtonWithLoading type="submit" loading={isSubmitting}>
            {submitButtonText}
          </ButtonWithLoading>
        </DialogFooter>
      </Form>
    </div>
  );
}

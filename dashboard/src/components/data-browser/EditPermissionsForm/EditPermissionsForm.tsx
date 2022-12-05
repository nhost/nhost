import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditPermissionsFormValues {}

export interface EditPermissionsFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: EditPermissionsFormValues) => Promise<void>;
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

export default function EditPermissionsForm({
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
}: EditPermissionsFormProps) {
  const form = useForm<EditPermissionsFormValues>({});
  const isDirty = false;
  const isSubmitting = false;

  async function handleSubmit(values: EditPermissionsFormValues) {
    await handleExternalSubmit(values);
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200"
      >
        <div className="flex-auto overflow-y-auto">Edit Permissions</div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 border-gray-200 p-2">
          <Button
            variant="borderless"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <Button
            loading={isSubmitting}
            disabled={isSubmitting}
            type="submit"
            className="justify-self-end"
          >
            {submitButtonText}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}

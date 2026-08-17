import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import type { DialogFormProps } from '@/types/common';

export interface BasePermissionVariableFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BasePermissionVariableFormValues) => void;
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

export const basePermissionVariableValidationSchema = Yup.object({
  key: Yup.string()
    .label('Field Name')
    .nullable()
    .required()
    .matches(/^[a-zA-Z-]+$/, {
      excludeEmptyString: true,
      message: 'Field Name can only contain letters and hyphens.',
    }),
  value: Yup.string()
    .label('Path')
    .nullable()
    .required()
    .matches(/^[a-zA-Z-_.[\]]+$/, {
      excludeEmptyString: true,
      message:
        'Path can only contain letters, hyphens, underscores, periods, and square brackets.',
    }),
});

export type BasePermissionVariableFormValues = Yup.InferType<
  typeof basePermissionVariableValidationSchema
>;

export default function BasePermissionVariableForm({
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BasePermissionVariableFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useFormContext<BasePermissionVariableFormValues>();

  const {
    control,
    formState: { dirtyFields, isSubmitting },
  } = form;

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <div className="grid grid-flow-row gap-2 px-6 pb-6">
      <p className="text-muted-foreground text-sm">
        Enter the field name and the path you want to use in this permission
        variable.
      </p>

      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        <FormInput
          control={control}
          name="key"
          label="Field Name"
          autoComplete="off"
          addonStart={<span className="shrink-0 pl-2">X-Hasura-</span>}
        />

        <FormInput
          control={control}
          name="value"
          label="Path"
          autoComplete="off"
          addonStart={<span className="shrink-0 pl-2">user.</span>}
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

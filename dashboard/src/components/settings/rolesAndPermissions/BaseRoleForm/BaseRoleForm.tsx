import Form from '@/components/common/Form';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';

export interface BaseRoleFormValues {
  /**
   * The name of the role.
   */
  roleName: string;
}

export interface BaseRoleFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseRoleFormValues) => Promise<void>;
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

export const baseRoleFormValidationSchema = Yup.object({
  roleName: Yup.string().required('This field is required.'),
});

export default function BaseRoleForm({
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
}: BaseRoleFormProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<BaseRoleFormValues>();

  return (
    <Form
      onSubmit={handleExternalSubmit}
      className="grid grid-flow-row gap-4 px-6 pb-6"
    >
      <Input
        {...register('roleName')}
        id="roleName"
        label="Role Name"
        placeholder="Enter value"
        hideEmptyHelperText
        error={!!errors.roleName}
        helperText={errors?.roleName?.message}
        fullWidth
      />

      <div className="grid grid-flow-row gap-2">
        <Button type="submit">{submitButtonText}</Button>

        <Button variant="outlined" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}

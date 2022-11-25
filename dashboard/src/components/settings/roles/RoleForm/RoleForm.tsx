import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import type { Role } from '@/types/application';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export interface RoleFormValues {
  /**
   * The name of the role.
   */
  name: string;
}

export interface RoleFormProps {
  /**
   * Available roles.
   */
  availableRoles: Role[];
  /**
   * Original role. This is defined only if the form was opened to edit an
   * existing role.
   */
  originalRole?: Role;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: RoleFormValues) => void;
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

const validationSchema = Yup.object({
  name: Yup.string().required('This field is required.'),
});

export default function RoleForm({
  availableRoles,
  originalRole,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
}: RoleFormProps) {
  const { onDirtyStateChange } = useDialog();
  const form = useForm<RoleFormValues>({
    defaultValues: {
      name: originalRole?.name || '',
    },
    resolver: yupResolver(validationSchema),
  });

  const {
    register,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = form;

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, 'dialog');
  }, [isDirty, onDirtyStateChange]);

  async function handleSubmit(values: RoleFormValues) {
    if (availableRoles.some((role) => role.name === values.name)) {
      setError('name', { message: 'This role already exists.' });

      return;
    }

    onSubmit?.(values);
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="grid grid-flow-row gap-4 px-6 pb-6"
      >
        <Input
          {...register('name')}
          inputProps={{ maxLength: 100 }}
          id="name"
          label="Name"
          placeholder="Enter value"
          hideEmptyHelperText
          error={!!errors.name}
          helperText={errors?.name?.message}
          fullWidth
          autoComplete="off"
          autoFocus
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
    </FormProvider>
  );
}

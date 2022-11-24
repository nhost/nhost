import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditRoleFormProps extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * Available roles.
   */
  availableRoles: string;
  /**
   * Original role name to be edited.
   */
  originalRole: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseRoleFormValues) => Promise<void>;
}

export default function EditRoleForm({
  originalRole,
  availableRoles,
  onSubmit,
  ...props
}: EditRoleFormProps) {
  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      roleName: originalRole,
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const { setError } = form;

  function handleSubmit(values: BaseRoleFormValues) {
    const existingRoleList = availableRoles.split(',') || [];
    const existingRoleListWithoutOriginalRole =
      existingRoleList.filter((role) => role !== originalRole) || [];

    if (existingRoleListWithoutOriginalRole.includes(values.roleName)) {
      setError('roleName', { message: 'This role already exists.' });

      return;
    }

    onSubmit?.(values);
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

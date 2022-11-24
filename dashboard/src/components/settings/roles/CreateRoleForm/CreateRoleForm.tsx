import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/roles/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/roles/BaseRoleForm';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * Available roles.
   */
  availableRoles: string;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: (values: BaseRoleFormValues) => Promise<void>;
}

export default function CreateRoleForm({
  availableRoles,
  onSubmit,
  ...props
}: CreateRoleFormProps) {
  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      roleName: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const { setError } = form;

  function handleSubmit(values: BaseRoleFormValues) {
    const existingRoleList = availableRoles?.split(',') || [];

    if (existingRoleList.includes(values.roleName)) {
      setError('roleName', { message: 'This role already exists.' });

      return;
    }

    onSubmit?.(values);
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm
        onSubmit={handleSubmit}
        submitButtonText="Create"
        {...props}
      />
    </FormProvider>
  );
}

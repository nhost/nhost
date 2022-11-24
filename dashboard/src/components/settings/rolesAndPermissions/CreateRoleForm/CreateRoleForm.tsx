import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateRoleForm() {
  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      roleName: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  async function handleSubmit(values: BaseRoleFormValues) {
    console.log(values);
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm onSubmit={handleSubmit} submitButtonText="Create" />
    </FormProvider>
  );
}

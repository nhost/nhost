import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/roles/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/roles/BaseRoleForm';
import useRemoteApplicationGQLClient from '@/hooks/useRemoteApplicationGQLClient';
import type { Role } from '@/types/application';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  refetchGetRemoteAppRolesQuery,
  useUpdateRemoteAppRoleMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditRoleFormProps extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * The role to be edited.
   */
  originalRole: Role;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditRoleForm({
  originalRole,
  onSubmit,
  ...props
}: EditRoleFormProps) {
  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      name: originalRole.name || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const remoteAppClient = useRemoteApplicationGQLClient();

  const [updateRole] = useUpdateRemoteAppRoleMutation({
    client: remoteAppClient,
    refetchQueries: [refetchGetRemoteAppRolesQuery()],
  });

  async function handleSubmit({ name }: BaseRoleFormValues) {
    const updateRolePromise = updateRole({
      variables: {
        role: originalRole.name,
        roleSetInput: {
          role: name,
        },
      },
    });

    await toast.promise(
      updateRolePromise,
      {
        loading: 'Updating role...',
        success: 'Role has been updated successfully.',
        error: 'An error occurred while trying to update the role.',
      },
      getToastStyleProps(),
    );

    await onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

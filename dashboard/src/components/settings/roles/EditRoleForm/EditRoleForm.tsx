import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/roles/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/roles/BaseRoleForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getUserRoles from '@/utils/settings/getUserRoles';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetRolesQuery,
  useUpdateAppMutation,
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
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      name: originalRole.name || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: ['getRoles'],
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading roles..." />;
  }

  if (error) {
    throw error;
  }

  const { setError } = form;
  const availableRoles = getUserRoles(data?.app?.authUserDefaultAllowedRoles);

  async function handleSubmit({ name }: BaseRoleFormValues) {
    if (
      availableRoles.some(
        (role) => role.name === name && role.name !== originalRole.name,
      )
    ) {
      setError('name', { message: 'This role already exists.' });

      return;
    }

    const defaultAllowedRolesList =
      data?.app?.authUserDefaultAllowedRoles.split(',') || [];

    const originalRoleIndex = defaultAllowedRolesList.findIndex(
      (role) => role.trim() === originalRole.name,
    );

    const updatedDefaultAllowedRoles = defaultAllowedRolesList
      .map((role, index) => {
        if (index === originalRoleIndex) {
          return name;
        }

        return role;
      })
      .join(',');

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultRole:
            data?.app?.authUserDefaultRole === originalRole.name
              ? name
              : data?.app?.authUserDefaultRole,
          authUserDefaultAllowedRoles: updatedDefaultAllowedRoles,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
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

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
import getServerError from '@/utils/settings/getServerError';
import getUserRoles from '@/utils/settings/getUserRoles';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel' | 'location'> {
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
  const { data, loading, error } = useGetRolesPermissionsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { allowed: allowedRoles, default: defaultRole } =
    data?.config?.auth?.user?.roles || {};

  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      name: originalRole.name || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading roles..." />;
  }

  if (error) {
    throw error;
  }

  const { setError } = form;
  const availableRoles = getUserRoles(allowedRoles);

  async function handleSubmit({ name }: BaseRoleFormValues) {
    if (
      availableRoles.some(
        (role) => role.name === name && role.name !== originalRole.name,
      )
    ) {
      setError('name', { message: 'This role already exists.' });

      return;
    }

    const defaultAllowedRolesList = allowedRoles || [];

    const originalRoleIndex = defaultAllowedRolesList.findIndex(
      (role) => role.trim() === originalRole.name,
    );

    const updatedDefaultAllowedRoles = defaultAllowedRolesList.map(
      (role, index) => {
        if (index === originalRoleIndex) {
          return name;
        }

        return role;
      },
    );

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication?.id,
        config: {
          auth: {
            user: {
              roles: {
                default: defaultRole === originalRole.name ? name : defaultRole,
                allowed: updatedDefaultAllowedRoles,
              },
            },
          },
        },
      },
    });

    await toast.promise(
      updateConfigPromise,
      {
        loading: 'Updating role...',
        success: 'Role has been updated successfully.',
        error: getServerError(
          'An error occurred while trying to update the role.',
        ),
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

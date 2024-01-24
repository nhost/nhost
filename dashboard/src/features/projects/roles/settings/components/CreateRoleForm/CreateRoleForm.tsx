import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/features/projects/roles/settings/components/BaseRoleForm';
import {
  BaseRoleForm,
  baseRoleFormValidationSchema,
} from '@/features/projects/roles/settings/components/BaseRoleForm';
import { getUserRoles } from '@/features/projects/roles/settings/utils/getUserRoles';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreateRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateRoleForm({
  onSubmit,
  ...props
}: CreateRoleFormProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading, error } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });
  const { allowed: allowedRoles } = data?.config?.auth?.user?.roles || {};

  const form = useForm<BaseRoleFormValues>({
    defaultValues: {},
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
    if (availableRoles.some((role) => role.name === name)) {
      setError('name', { message: 'This role already exists.' });

      return;
    }

    const updatedAllowedRoles = allowedRoles ? [...allowedRoles, name] : [name];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          auth: {
            user: {
              roles: {
                allowed: updatedAllowedRoles,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        onSubmit?.();
      },
      {
        loadingMessage: 'Creating role...',
        successMessage: 'Role has been created successfully.',
        errorMessage: 'An error occurred while trying to create the role.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm submitButtonText="Add" onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

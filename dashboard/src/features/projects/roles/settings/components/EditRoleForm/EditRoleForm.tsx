import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/features/projects/roles/settings/components/BaseRoleForm';
import {
  BaseRoleForm,
  baseRoleFormValidationSchema,
} from '@/features/projects/roles/settings/components/BaseRoleForm';
import { getUserRoles } from '@/features/projects/roles/settings/utils/getUserRoles';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import type { Role } from '@/types/application';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel' | 'location'> {
  /**
   * The role to be edited.
   */
  originalRole: Role;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<any>;
}

export default function EditRoleForm({
  originalRole,
  onSubmit,
  ...props
}: EditRoleFormProps) {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading, error } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
        appId: currentProject?.id,
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

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        await onSubmit?.();

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Updating role...',
        successMessage: 'Role has been updated successfully.',
        errorMessage: 'An error occurred while trying to update the role.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

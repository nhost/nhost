import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/features/orgs/projects/permissions/settings/components/BasePermissionVariableForm';
import {
  BasePermissionVariableForm,
  basePermissionVariableValidationSchema,
} from '@/features/orgs/projects/permissions/settings/components/BasePermissionVariableForm';
import { getAllPermissionVariables } from '@/features/orgs/projects/permissions/settings/utils/getAllPermissionVariables';
import type { PermissionVariable } from '@/types/application';
import {
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface EditPermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel' | 'location'> {
  /**
   * The permission variable to be edited.
   */
  originalVariable: PermissionVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => any;
}

export default function EditPermissionVariableForm({
  originalVariable,
  onSubmit,
  ...props
}: EditPermissionVariableFormProps) {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error, loading } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { customClaims: permissionVariables } =
    data?.config?.auth?.session?.accessToken || {};

  const form = useForm<BasePermissionVariableFormValues>({
    defaultValues: {
      key: originalVariable.key || '',
      value: originalVariable.value || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(basePermissionVariableValidationSchema),
  });

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  if (error) {
    throw error;
  }

  const { setError } = form;
  const availablePermissionVariables =
    getAllPermissionVariables(permissionVariables);

  async function handleSubmit({
    key,
    value,
  }: BasePermissionVariableFormValues) {
    if (
      availablePermissionVariables.some(
        (permissionVariable) =>
          permissionVariable.key === key &&
          permissionVariable.key !== originalVariable.key,
      )
    ) {
      setError('key', { message: 'This key is already in use.' });

      return;
    }

    const originalPermissionVariableIndex =
      availablePermissionVariables.findIndex(
        (permissionVariable) => permissionVariable.key === originalVariable.key,
      );

    const updatedPermissionVariables = availablePermissionVariables
      .map((permissionVariable, index) => {
        if (permissionVariable.isSystemVariable) {
          return null;
        }

        if (index === originalPermissionVariableIndex) {
          return {
            key,
            value,
          };
        }

        return {
          key: permissionVariable.key,
          value: permissionVariable.value,
        };
      })
      .filter(Boolean);

    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            session: {
              accessToken: {
                customClaims: updatedPermissionVariables,
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
        loadingMessage: 'Updating permission variable...',
        successMessage: 'Permission variable has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the permission variable.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BasePermissionVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

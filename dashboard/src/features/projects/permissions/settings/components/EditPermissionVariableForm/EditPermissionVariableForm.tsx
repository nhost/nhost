import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/features/projects/permissions/settings/components/BasePermissionVariableForm';
import {
  BasePermissionVariableForm,
  basePermissionVariableValidationSchema,
} from '@/features/projects/permissions/settings/components/BasePermissionVariableForm';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import type { PermissionVariable } from '@/types/application';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditPermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel' | 'location'> {
  /**
   * The permission variable to be edited.
   */
  originalVariable: PermissionVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditPermissionVariableForm({
  originalVariable,
  onSubmit,
  ...props
}: EditPermissionVariableFormProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, error, loading } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
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
    refetchQueries: [GetRolesPermissionsDocument],
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
        appId: currentProject?.id,
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
      },
      {
        loadingMessage: 'Updating permission variable...',
        successMessage: 'Permission variable has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the permission variable.',
      },
    );

    await onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BasePermissionVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

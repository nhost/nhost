import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import BasePermissionVariableForm, {
  basePermissionVariableValidationSchema,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { PermissionVariable } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getAllPermissionVariables from '@/utils/settings/getAllPermissionVariables';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditPermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel'> {
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
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, error, loading } = useGetRolesPermissionsQuery({
    variables: { appId: currentApplication?.id },
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
        appId: currentApplication?.id,
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

    await toast.promise(
      updateConfigPromise,
      {
        loading: 'Updating permission variable...',
        success: 'Permission variable has been updated successfully.',
        error:
          'An error occurred while trying to update the permission variable.',
      },
      getToastStyleProps(),
    );

    await onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BasePermissionVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

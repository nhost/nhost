import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import BasePermissionVariableForm, {
  basePermissionVariableValidationSchema,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { CustomClaim } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getPermissionVariables from '@/utils/settings/getPermissionVariablesArray';
import getPermissionVariablesObject from '@/utils/settings/getPermissionVariablesObject';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetAppCustomClaimsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditPermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel'> {
  /**
   * The permission variable to be edited.
   */
  originalVariable: CustomClaim;
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

  const { data, error, loading } = useGetAppCustomClaimsQuery({
    variables: { id: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<BasePermissionVariableFormValues>({
    defaultValues: {
      key: originalVariable.key || '',
      value: originalVariable.value || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(basePermissionVariableValidationSchema),
  });

  const [updateApp] = useUpdateAppMutation({
    refetchQueries: ['getAppCustomClaims'],
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
  const availablePermissionVariables = getPermissionVariables(
    data?.app?.authJwtCustomClaims,
  );

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

    const updatedPermissionVariables = availablePermissionVariables.map(
      (permissionVariable, index) => {
        if (index === originalPermissionVariableIndex) {
          return { key, value };
        }

        return permissionVariable;
      },
    );

    const permissionVariablesObject = getPermissionVariablesObject(
      updatedPermissionVariables.filter(
        (permissionVariable) => !permissionVariable.isSystemClaim,
      ),
    );

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authJwtCustomClaims: {
            ...permissionVariablesObject,
            [key]: value,
          },
        },
      },
    });

    await toast.promise(
      updateAppPromise,
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

import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import BasePermissionVariableForm, {
  basePermissionVariableValidationSchema,
} from '@/components/settings/permissions/BasePermissionVariableForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getPermissionVariablesArray from '@/utils/settings/getPermissionVariablesArray';
import getPermissionVariablesObject from '@/utils/settings/getPermissionVariablesObject';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetAppCustomClaimsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface CreatePermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreatePermissionVariableForm({
  onSubmit,
  ...props
}: CreatePermissionVariableFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, error, loading } = useGetAppCustomClaimsQuery({
    variables: { id: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<BasePermissionVariableFormValues>({
    defaultValues: {
      key: '',
      value: '',
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
  const availablePermissionVariables = getPermissionVariablesArray(
    data?.app?.authJwtCustomClaims,
  );

  async function handleSubmit({
    key,
    value,
  }: BasePermissionVariableFormValues) {
    if (
      availablePermissionVariables.some(
        (permissionVariable) => permissionVariable.key === key,
      )
    ) {
      setError('key', { message: 'This key is already in use.' });

      return;
    }

    const permissionVariablesObject = getPermissionVariablesObject(
      availablePermissionVariables.filter(
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
        loading: 'Creating permission variable...',
        success: 'Permission variable has been created successfully.',
        error:
          'An error occurred while trying to create the permission variable.',
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

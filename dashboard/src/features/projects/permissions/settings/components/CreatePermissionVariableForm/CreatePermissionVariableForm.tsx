import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type {
  BasePermissionVariableFormProps,
  BasePermissionVariableFormValues,
} from '@/features/projects/permissions/settings/components/BasePermissionVariableForm';
import {
  BasePermissionVariableForm,
  basePermissionVariableValidationSchema,
} from '@/features/projects/permissions/settings/components/BasePermissionVariableForm';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import {
  GetRolesPermissionsDocument,
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';

export interface CreatePermissionVariableFormProps
  extends Pick<BasePermissionVariableFormProps, 'onCancel' | 'location'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<any>;
}

export default function CreatePermissionVariableForm({
  onSubmit,
  ...props
}: CreatePermissionVariableFormProps) {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, error, loading } = useGetRolesPermissionsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { customClaims: permissionVariables } =
    data?.config?.auth?.session?.accessToken || {};

  const form = useForm<BasePermissionVariableFormValues>({
    defaultValues: {
      key: '',
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(basePermissionVariableValidationSchema),
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetRolesPermissionsDocument],
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
        (permissionVariable) => permissionVariable.key === key,
      )
    ) {
      setError('key', { message: 'This key is already in use.' });

      return;
    }

    const existingPermissionVariables =
      permissionVariables?.map((permissionVariable) => ({
        key: permissionVariable.key,
        value: permissionVariable.value,
      })) || [];

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          auth: {
            session: {
              accessToken: {
                customClaims: [...existingPermissionVariables, { key, value }],
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
        loadingMessage: 'Creating permission variable...',
        successMessage: 'Permission variable has been created successfully.',
        errorMessage:
          'An error occurred while trying to create the permission variable.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <BasePermissionVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

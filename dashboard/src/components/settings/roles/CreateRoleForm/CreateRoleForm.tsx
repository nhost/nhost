import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/roles/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/roles/BaseRoleForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
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

export interface CreateRoleFormProps
  extends Pick<BaseRoleFormProps, 'onCancel'> {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function CreateRoleForm({
  onSubmit,
  ...props
}: CreateRoleFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<BaseRoleFormValues>({
    defaultValues: {},
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  const [updateApp] = useUpdateAppMutation({ refetchQueries: ['getRoles'] });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading roles..." />;
  }

  if (error) {
    throw error;
  }

  const { setError } = form;
  const availableRoles = getUserRoles(data?.app?.authUserDefaultAllowedRoles);

  async function handleSubmit({ name }: BaseRoleFormValues) {
    if (availableRoles.some((role) => role.name === name)) {
      setError('name', { message: 'This role already exists.' });

      return;
    }

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultAllowedRoles: `${data?.app?.authUserDefaultAllowedRoles},${name}`,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Creating role...',
        success: 'Role has been created successfully.',
        error: 'An error occurred while trying to create the role.',
      },
      getToastStyleProps(),
    );

    await onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseRoleForm submitButtonText="Add" onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}

import type {
  BaseRoleFormProps,
  BaseRoleFormValues,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import BaseRoleForm, {
  baseRoleFormValidationSchema,
} from '@/components/settings/rolesAndPermissions/BaseRoleForm';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
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
  onSubmit?: (values: BaseRoleFormValues) => Promise<void>;
}

export default function CreateRoleForm({
  onSubmit,
  ...props
}: CreateRoleFormProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const {
    data,
    loading,
    error: getRolesError,
  } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });
  const [updateApp, { error, reset }] = useUpdateAppMutation({
    refetchQueries: ['getRoles'],
  });

  const form = useForm<BaseRoleFormValues>({
    defaultValues: {
      roleName: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseRoleFormValidationSchema),
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (getRolesError) {
    throw getRolesError;
  }

  const { setError } = form;

  async function handleSubmit(values: BaseRoleFormValues) {
    const { authUserDefaultAllowedRoles: existingRoles } = data.app || {};
    const existingRoleList = existingRoles ? existingRoles.split(',') : [];

    if (existingRoleList.includes(values.roleName)) {
      setError('roleName', { message: 'This role already exists.' });

      return;
    }

    const newRoles = `${existingRoles},${values.roleName}`;

    const updateAppPromise = updateApp({
      variables: {
        id: currentApplication?.id,
        app: {
          authUserDefaultAllowedRoles: newRoles,
        },
      },
    });

    await toast.promise(
      updateAppPromise,
      {
        loading: 'Creating role...',
        success: 'Role has been created successfully.',
        error: 'An error occurred while creating the role.',
      },
      toastStyleProps,
    );

    onSubmit?.(values);
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error && (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            severity="error"
            className="grid grid-flow-col items-center justify-between px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>

            <Button
              variant="borderless"
              color="secondary"
              className="p-1"
              onClick={reset}
            >
              Clear
            </Button>
          </Alert>
        </div>
      )}

      <BaseRoleForm
        onSubmit={handleSubmit}
        submitButtonText="Create"
        {...props}
      />
    </FormProvider>
  );
}

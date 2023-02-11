import ControlledSelect from '@/components/common/ControlledSelect';
import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import Option from '@/components/ui/v2/Option';
import useCurrentWorkspaceAndApplication from '@/hooks/useCurrentWorkspaceAndApplication';
import useRemoteApplicationGQLClient from '@/hooks/useRemoteApplicationGQLClient';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetRemoteAppRolesQuery,
  useGetRolesQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface DefaultRoleSettingsFormValues {
  /**
   * Default role.
   */
  authUserDefaultRole: string;
}

export default function DefaultRoleSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  // get the remote app gql client
  const remoteProjectGqlClient = useRemoteApplicationGQLClient();

  // get roles from the remote app
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({
    client: remoteProjectGqlClient,
  });

  // get default role and default allowed roles
  const {
    data: appData,
    loading: appLoading,
    error: appError,
  } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  const form = useForm<DefaultRoleSettingsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authUserDefaultRole: appData?.app.authUserDefaultRole || '',
    },
  });

  // reset form when appData has loaded
  useEffect(() => {
    form.reset(() => ({
      authUserDefaultRole: appData?.app.authUserDefaultRole || '',
    }));
  }, [appData?.app, form, form.reset]);

  const [updateApp, { loading: updateAppLoading }] = useUpdateAppMutation();

  const handleSubmit = async (values: DefaultRoleSettingsFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Default role is being updated...`,
        success: `Default role have been updated successfully.`,
        error: `An error occurred while trying to update the default role.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  if (rolesLoading || appLoading) {
    return <ActivityIndicator delay={1000} label="Loading roles..." />;
  }

  if (rolesError || appError) {
    throw rolesError || appError;
  }

  const { register } = form;

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Default Role"
          description="The default role given to new users"
          docsLink="https://docs.nhost.io/authentication/users#default-role"
          rootClassName="gap-0"
          className="grid grid-flow-col grid-cols-5 py-6"
          slotProps={{
            submitButton: {
              value: 'Save',
              loading: updateAppLoading,
            },
          }}
        >
          <ControlledSelect
            {...register('authUserDefaultRole')}
            id="authUserDefaultRole"
            className="col-span-5 lg:col-span-2"
            placeholder="Default Role"
            hideEmptyHelperText
            variant="normal"
            label="Default Role"
          >
            {rolesData.authRoles
              .map((role) => ({ value: role.role, label: role.role }))
              .map(({ value, label }) => (
                <Option key={value} value={value}>
                  {label}
                </Option>
              ))}
          </ControlledSelect>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

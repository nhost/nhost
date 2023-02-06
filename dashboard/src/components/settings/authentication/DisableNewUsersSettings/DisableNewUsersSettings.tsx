import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import {
  useGetAuthSettingsQuery,
  useUpdateAppMutation,
} from '@/utils/__generated__/graphql';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface DisableNewUsersFormValues {
  /**
   * Disable new users from signing up to this project
   */
  authDisableNewUsers: boolean;
}

export default function DisableNewUsersSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useGetAuthSettingsQuery({
    variables: {
      id: currentApplication.id,
    },
  });

  const form = useForm<DisableNewUsersFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authDisableNewUsers: data?.app?.authDisableNewUsers,
    },
  });

  useEffect(() => {
    form.reset(() => ({
      authDisableNewUsers: data?.app?.authDisableNewUsers,
    }));
  }, [data?.app?.authDisableNewUsers, form, form.reset]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading disabled sign up settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authDisableNewUsers = watch('authDisableNewUsers');

  const handleDisableNewUsersChange = async (
    values: DisableNewUsersFormValues,
  ) => {
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
        loading: `Disabling new user sign ups...`,
        success: `New user sign ups have been disabled successfully.`,
        error: `An error occurred while trying to disable new user sign ups.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDisableNewUsersChange}>
        <SettingsContainer
          title="Disable New Users"
          description="If set, newly registered users are disabled and won’t be able to sign in."
          docsLink="https://docs.nhost.io/authentication#disable-new-users"
          switchId="authDisableNewUsers"
          showSwitch
          enabled={authDisableNewUsers}
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

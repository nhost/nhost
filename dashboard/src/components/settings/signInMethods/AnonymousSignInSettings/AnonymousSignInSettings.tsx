import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  useSignInMethodsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface AnonymousSignInFormValues {
  /**
   * Enables users to register as an anonymous user.
   */
  authAnonymousUsersEnabled: boolean;
}

export default function AnonymousSignInSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<AnonymousSignInFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authAnonymousUsersEnabled: data.app.authAnonymousUsersEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const handlePasswordProtectionSettingsChange = async (
    values: AnonymousSignInFormValues,
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
        loading: `Anonymous sign-in settings are being updated...`,
        success: `Anonymous sign-in settings have been updated successfully.`,
        error: `An error occurred while trying to update Anonymous sign-in settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handlePasswordProtectionSettingsChange}>
        <SettingsContainer
          title="Anonymous Users"
          description="Allow users to sign in anonymously."
          primaryActionButtonProps={{
            disabled:
              form.formState.isSubmitting ||
              !form.formState.isValid ||
              !form.formState.isDirty,
          }}
          enabled={form.getValues('authAnonymousUsersEnabled')}
          switchId="authAnonymousUsersEnabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

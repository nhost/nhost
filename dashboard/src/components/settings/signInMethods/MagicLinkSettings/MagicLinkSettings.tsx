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

export interface MagicLinkFormValues {
  /**
   * Enables passwordless authentication by email.
   */
  authEmailPasswordlessEnabled: boolean;
}

export default function MagicLinkSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<MagicLinkFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authEmailPasswordlessEnabled: data.app.authEmailPasswordlessEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Magic Link settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authEmailPasswordlessEnabled = watch('authEmailPasswordlessEnabled');

  const handleMagicLinkSettingsUpdate = async (values: MagicLinkFormValues) => {
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
        loading: `Magic Link settings are being updated...`,
        success: `Magic Link settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's Magic Link settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleMagicLinkSettingsUpdate}>
        <SettingsContainer
          title="Magic Link"
          description="Allow users to sign in with a Magic Link."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-magic-link"
          docsTitle="how to sign in users with Magic Link"
          enabled={authEmailPasswordlessEnabled}
          switchId="authEmailPasswordlessEnabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

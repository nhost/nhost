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

export interface WebAuthnFormValues {
  /**
   * When enabled, passwordless Webauthn authentication can be done
   * via device supported strong authenticators like fingerprint, Face ID, etc.
   */
  authWebAuthnEnabled: boolean;
}

export default function WebAuthnSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();

  const { data, loading, error } = useSignInMethodsQuery({
    variables: {
      id: currentApplication.id,
    },
    fetchPolicy: 'cache-only',
  });

  const form = useForm<WebAuthnFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      authWebAuthnEnabled: data.app.authWebAuthnEnabled,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading WebAuthn settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState, watch } = form;
  const authWebAuthnEnabled = watch('authWebAuthnEnabled');

  const handleWebAuthnSettingsUpdate = async (values: WebAuthnFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          authWebAuthnEnabled: values.authWebAuthnEnabled,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `WebAuthn settings are being updated...`,
        success: `WebAuthn settings have been updated successfully.`,
        error: `An error occurred while trying to update the project's WebAuthn settings.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleWebAuthnSettingsUpdate}>
        <SettingsContainer
          title="Security Keys"
          description="Allow users to sign in with security keys using WebAuthn."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-security-keys"
          docsTitle="how to sign in users with security keys"
          enabled={authWebAuthnEnabled}
          switchId="authWebAuthnEnabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type WebAuthnFormValues = Yup.InferType<typeof validationSchema>;

export default function WebAuthnSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { enabled } = data?.config?.auth?.method?.webauthn || {};

  const form = useForm<WebAuthnFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled,
    },
    resolver: yupResolver(validationSchema),
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

  const { formState } = form;

  const handleWebAuthnSettingsUpdate = async (values: WebAuthnFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            method: {
              webauthn: values,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `WebAuthn settings are being updated...`,
          success: `WebAuthn settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's WebAuthn settings.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(values);
    } catch {
      // Note: The toast will handle the error.
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleWebAuthnSettingsUpdate}>
        <SettingsContainer
          title="Security Keys"
          description="Allow users to sign in with security keys using WebAuthn."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-security-keys"
          docsTitle="how to sign in users with security keys"
          switchId="enabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

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

export type AnonymousSignInFormValues = Yup.InferType<typeof validationSchema>;

export default function AnonymousSignInSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { enabled } = data?.config?.auth?.method?.anonymous || {};

  const form = useForm<AnonymousSignInFormValues>({
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
        label="Loading anonymous sign-in settings..."
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
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            method: {
              anonymous: values,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Anonymous sign-in settings are being updated...`,
          success: `Anonymous sign-in settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update Anonymous sign-in settings.`,
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
      <Form onSubmit={handlePasswordProtectionSettingsChange}>
        <SettingsContainer
          title="Anonymous Users"
          description="Allow users to sign in anonymously."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

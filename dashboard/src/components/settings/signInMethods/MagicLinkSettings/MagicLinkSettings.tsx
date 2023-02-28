import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
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

export type MagicLinkFormValues = Yup.InferType<typeof validationSchema>;

export default function MagicLinkSettings() {
  const { projectManagementDisabled } = useUI();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentApplication?.id },
    fetchPolicy: 'cache-only',
  });

  const { enabled } = data?.config?.auth?.method?.emailPasswordless || {};

  const form = useForm<MagicLinkFormValues>({
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
        label="Loading settings for Magic Link..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  const { formState } = form;

  const handleMagicLinkSettingsUpdate = async (values: MagicLinkFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication.id,
        config: {
          auth: {
            method: {
              emailPasswordless: values,
            },
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: `Magic Link settings are being updated...`,
          success: `Magic Link settings have been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the project's Magic Link settings.`,
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
      <Form onSubmit={handleMagicLinkSettingsUpdate}>
        <SettingsContainer
          title="Magic Link"
          description="Allow users to sign in with a Magic Link."
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || projectManagementDisabled,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/authentication/sign-in-with-magic-link"
          docsTitle="how to sign in users with Magic Link"
          switchId="enabled"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

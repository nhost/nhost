import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetSignInMethodsDocument,
  useGetSignInMethodsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type AnonymousSignInFormValues = Yup.InferType<typeof validationSchema>;

export default function AnonymousSignInSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetSignInMethodsDocument],
  });

  const { data, loading, error } = useGetSignInMethodsQuery({
    variables: { appId: currentProject?.id },
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
        appId: currentProject.id,
        config: {
          auth: {
            method: {
              anonymous: values,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);
      },
      {
        loadingMessage: 'Anonymous sign-in settings are being updated...',
        successMessage:
          'Anonymous sign-in settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Anonymous sign-in settings.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handlePasswordProtectionSettingsChange}>
        <SettingsContainer
          title="Anonymous Users"
          description="Allow users to sign in anonymously."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
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

import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type HasuraConsoleFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraConsoleSettings() {
  const { maintenanceActive } = useUI();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-first',
  });

  const { enableConsole } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraConsoleFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: enableConsole,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Hasura Console settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraConsoleFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            settings: {
              enableConsole: formValues.enabled,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchWorkspaceAndProject();
      },
      {
        loadingMessage: 'Hasura Console settings are being updated...',
        successMessage:
          'Hasura Console settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Hasura Console settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Hasura Console"
          description="Enable or disable the Hasura Console. This will enable or disable the Hasura Console on the dashboard as well."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          docsTitle="enabling or disabling the Hasura Console"
          docsLink="https://hasura.io/docs/latest/deployment/graphql-engine-flags/reference/#enable-console"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

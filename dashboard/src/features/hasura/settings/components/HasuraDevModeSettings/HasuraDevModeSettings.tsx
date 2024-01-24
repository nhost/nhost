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

export type HasuraDevModeFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraDevModeSettings() {
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

  const { devMode } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraDevModeFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: devMode,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Dev Mode settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: HasuraDevModeFormValues) {
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
        loadingMessage: 'Dev Mode settings are being updated...',
        successMessage: 'Dev Mode settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update Dev Mode settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Dev Mode"
          description="Enable or disable Dev Mode."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          docsTitle="enabling or disabling Dev Mode"
          docsLink="https://hasura.io/learn/graphql/hasura-advanced/debugging/1-dev-mode/"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

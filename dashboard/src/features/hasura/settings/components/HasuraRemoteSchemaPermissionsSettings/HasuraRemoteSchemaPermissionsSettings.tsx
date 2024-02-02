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

export type HasuraRemoteSchemaPermissionsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraRemoteSchemaPermissionsSettings() {
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

  const { enableRemoteSchemaPermissions } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraRemoteSchemaPermissionsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: enableRemoteSchemaPermissions,
    },
    resolver: yupResolver(validationSchema),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading remote schema permission settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(
    formValues: HasuraRemoteSchemaPermissionsFormValues,
  ) {
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
        loadingMessage:
          'Remote schema permission settings are being updated...',
        successMessage:
          'Remote schema permission settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update remote schema permission settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Remote Schema Permissions"
          description="Enable or disable remote schema permissions."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          docsTitle="enabling or disabling Remote Schema Permissions"
          docsLink="https://hasura.io/docs/latest/remote-schemas/auth/remote-schema-permissions/"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

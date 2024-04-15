import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  GetHasuraSettingsDocument,
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type HasuraDevModeFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraDevModeSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { currentProject, refetch: refetchWorkspaceAndProject } =
    useCurrentWorkspaceAndProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetHasuraSettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { devMode } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraDevModeFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: devMode,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: devMode,
      });
    }
  }, [loading, devMode, form]);

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
              devMode: formValues.enabled,
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

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
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

import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  useGetHasuraSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type HasuraInferFunctionPermissionsFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function HasuraInferFunctionPermissionsSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { inferFunctionPermissions } = data?.config?.hasura.settings || {};

  const form = useForm<HasuraInferFunctionPermissionsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: inferFunctionPermissions,
    },
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: inferFunctionPermissions,
      });
    }
  }, [loading, inferFunctionPermissions, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading infer function permissions settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(
    formValues: HasuraInferFunctionPermissionsFormValues,
  ) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          hasura: {
            settings: {
              inferFunctionPermissions: formValues.enabled,
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);
        await refetchProject();

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
        loadingMessage:
          'Infer function permission settings are being updated...',
        successMessage:
          'Infer function permission settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update infer function permission settings.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Infer Function Permissions"
          description="Enable or disable infer function permissions."
          slotProps={{
            submitButton: {
              disabled: !form.formState.isDirty || maintenanceActive,
              loading: form.formState.isSubmitting,
            },
          }}
          switchId="enabled"
          docsTitle="enabling or disabling Infer Function Permissions"
          docsLink="https://hasura.io/docs/2.0/deployment/graphql-engine-flags/reference/#infer-function-permissions"
          showSwitch
          className="hidden"
        />
      </Form>
    </FormProvider>
  );
}

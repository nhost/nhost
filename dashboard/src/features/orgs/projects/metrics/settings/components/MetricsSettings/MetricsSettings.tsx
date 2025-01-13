import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ContactPointsSettings } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings';
import { MetricsSMTPSettings } from '@/features/orgs/projects/metrics/settings/components/MetricsSMTPSettings';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetObservabilitySettingsDocument,
  useGetObservabilitySettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const metricsAlertingValidationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type MetricsAlertingFormValues = Yup.InferType<
  typeof metricsAlertingValidationSchema
>;

export default function MetricsSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const {
    project,
    refetch: refetchProject,
    loading: loadingProject,
  } = useProject();
  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetObservabilitySettingsDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    data,
    loading: loadingObservabilitySettings,
    error,
  } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
    skip: !project?.id,
  });

  const { enabled: alertingEnabled } =
    data?.config?.observability.grafana.alerting || {};

  const alertingForm = useForm<MetricsAlertingFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: alertingEnabled,
    },
    resolver: yupResolver(metricsAlertingValidationSchema),
  });

  const { watch } = alertingForm;
  const alerting = watch('enabled');

  useEffect(() => {
    if (!loadingObservabilitySettings) {
      alertingForm.reset({
        enabled: alertingEnabled,
      });
    }
  }, [loadingObservabilitySettings, alertingEnabled, alertingForm]);

  if (loadingProject || loadingObservabilitySettings) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Alerting settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: MetricsAlertingFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project.id,
        config: {
          observability: {
            grafana: {
              alerting: {
                enabled: formValues.enabled,
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        alertingForm.reset(formValues);
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
        loadingMessage: 'Alerting settings are being updated...',
        successMessage: 'Alerting settings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update alerting settings.',
      },
    );
  }

  return (
    <div className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent">
      <FormProvider {...alertingForm}>
        <Form onSubmit={handleSubmit}>
          <SettingsContainer
            title="Alerting"
            description="Enable or disable Alerting."
            slotProps={{
              submitButton: {
                disabled: !alertingForm.formState.isDirty || maintenanceActive,
                loading: alertingForm.formState.isSubmitting,
              },
            }}
            switchId="enabled"
            docsTitle="enabling or disabling Alerting"
            docsLink="https://docs.nhost.io/platform/metrics#alerting"
            showSwitch
            className="hidden"
          />
        </Form>
      </FormProvider>
      {alerting ? (
        <>
          <MetricsSMTPSettings />
          <ContactPointsSettings />
        </>
      ) : null}
    </div>
  );
}

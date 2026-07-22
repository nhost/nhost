import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { FormField } from '@/components/ui/v3/form';
import { Switch } from '@/components/ui/v3/switch';
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

const metricsAlertingValidationSchema = Yup.object({
  enabled: Yup.boolean(),
});

export type MetricsAlertingFormValues = Yup.InferType<
  typeof metricsAlertingValidationSchema
>;

export default function MetricsSettings() {
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, refetch: refetchProject } = useProject();
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

  const alertingEnabled =
    !!data?.config?.observability.grafana.alerting?.enabled;

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

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: MetricsAlertingFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
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
    <div className="grid grid-flow-row gap-y-6">
      <FormProvider {...alertingForm}>
        <Form onSubmit={handleSubmit}>
          <SettingsCard>
            <SettingsCardHeader
              title="Alerting"
              description="Enable or disable Alerting."
              control={
                <FormField
                  control={alertingForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Toggle Alerting"
                    />
                  )}
                />
              }
            />

            <SettingsCardFooter>
              <SettingsDocsLink
                href="https://docs.nhost.io/platform/cloud/metrics#alerting"
                title="enabling or disabling Alerting"
              />

              <ButtonWithLoading
                type="submit"
                disabled={!alertingForm.formState.isDirty}
                loading={alertingForm.formState.isSubmitting}
                className="w-full sm:w-auto"
              >
                Save
              </ButtonWithLoading>
            </SettingsCardFooter>
          </SettingsCard>
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

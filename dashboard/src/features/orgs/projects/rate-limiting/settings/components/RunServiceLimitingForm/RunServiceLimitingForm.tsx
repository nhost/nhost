import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Divider } from '@/components/ui/v2/Divider';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitField } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitField';
import { rateLimitingItemValidationSchema } from '@/features/orgs/projects/rate-limiting/settings/components/validationSchemas';
import type { UseGetRunServiceRateLimitsReturn } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits/useGetRunServiceRateLimits';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  ports: Yup.array().of(rateLimitingItemValidationSchema),
});

export type RunServiceLimitingFormValues = Yup.InferType<
  typeof validationSchema
>;

export interface RunServiceLimitingFormProps {
  title?: string;
  serviceId?: string;
  loading?: boolean;
  enabledDefault?: boolean;
  ports?: UseGetRunServiceRateLimitsReturn['services'][0]['ports'];
}

export default function RunServiceLimitingForm({
  title,
  serviceId,
  ports,
  loading,
  enabledDefault,
}: RunServiceLimitingFormProps) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();

  const [updateRunServiceRateLimit] = useUpdateRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<RunServiceLimitingFormValues>({
    defaultValues: {
      enabled: enabledDefault,
      ports: [
        ...ports.map((port) => ({
          limit: port?.rateLimit?.limit,
          interval: port?.rateLimit?.interval,
          intervalUnit: port?.rateLimit?.intervalUnit,
        })),
      ],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && enabledDefault) {
      form.reset({
        enabled: enabledDefault,
        ports: [
          ...ports.map((port) => ({
            limit: port?.rateLimit?.limit,
            interval: port?.rateLimit?.interval,
            intervalUnit: port?.rateLimit?.intervalUnit,
          })),
        ],
      });
    }
  }, [loading, enabledDefault, ports, form]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading rate limits..."
        className="justify-center"
      />
    );
  }

  const {
    register,
    formState: { errors },
    formState,
    watch,
  } = form;

  const enabled = watch('enabled');

  const handleSubmit = async (formValues: RunServiceLimitingFormValues) => {
    const updateConfigPromise = updateRunServiceRateLimit({
      variables: {
        appID: project?.id,
        serviceID: serviceId,
        config: {
          ports: ports.map((port, index) => {
            const rateLimit = formValues.ports[index];
            return {
              ...port,
              rateLimit: enabled
                ? {
                    limit: rateLimit.limit,
                    interval: `${rateLimit.interval}${rateLimit.intervalUnit}`,
                  }
                : null,
            };
          }),
        },
      },
    });
    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(formValues);

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
        loadingMessage: 'Updating Run service rate limit settings...',
        successMessage: 'Run service rate limit settings updated successfully',
        errorMessage: 'Failed to update Run service rate limit settings',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden"
      >
        <SettingsContainer
          title={title}
          switchId="enabled"
          showSwitch
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="flex flex-col px-0"
        >
          <Divider />
          {ports.map((port, index) => {
            if (port?.type !== 'http' || !port?.publish) {
              return null;
            }

            const fieldTitle = `${port.type} <-> ${port.port}`.toUpperCase();
            const showDivider = index < ports.length - 1;
            return (
              <div key={`ports.${port.port}`}>
                <RateLimitField
                  title={fieldTitle}
                  disabled={!enabled}
                  register={register}
                  errors={errors.ports}
                  id={`ports.${index}`}
                />
                {showDivider && <Divider />}
              </div>
            );
          })}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

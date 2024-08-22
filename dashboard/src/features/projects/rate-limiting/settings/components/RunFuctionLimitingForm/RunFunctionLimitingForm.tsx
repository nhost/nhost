import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Divider } from '@/components/ui/v2/Divider';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { rateLimitingItemValidationSchema } from '@/features/projects/rate-limiting/settings/components/validationSchemas';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useUpdateRunServiceConfigMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { RateLimitField } from 'features/projects/rate-limiting/settings/components/RateLimitField';
import type { UseGetRunServiceRateLimitsReturn } from 'features/projects/rate-limiting/settings/hooks/useGetRunServiceRateLimits/useGetRunServiceRateLimits';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  ports: Yup.array().of(rateLimitingItemValidationSchema),
});

export type RunFunctionLimitingFormValues = Yup.InferType<
  typeof validationSchema
>;

export interface RunFunctionLimitingFormProps {
  title?: string;
  serviceId?: string;
  loading?: boolean;
  ports?: UseGetRunServiceRateLimitsReturn['services'][0]['ports'];
  rawPorts?: UseGetRunServiceRateLimitsReturn['services'][0]['rawPorts'];
}

export default function RunFunctionLimitingForm({
  title,
  serviceId,
  ports,
  loading,
  rawPorts,
}: RunFunctionLimitingFormProps) {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const isPlatform = useIsPlatform();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();

  const [updateRunServiceRateLimit] = useUpdateRunServiceConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const runFunctionEnabledByDefault = !!ports?.some((port) => port.rateLimit);

  const form = useForm<RunFunctionLimitingFormValues>({
    defaultValues: {
      enabled: runFunctionEnabledByDefault,
      ports: [
        ...ports.map((port) => ({
          limit: port.rateLimit?.limit,
          interval: port.rateLimit?.interval,
          intervalUnit: port.rateLimit?.intervalUnit,
        })),
      ],
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && runFunctionEnabledByDefault) {
      form.reset({
        enabled: runFunctionEnabledByDefault,
        ports: [
          ...ports.map((port) => ({
            limit: port.rateLimit?.limit,
            interval: port.rateLimit?.interval,
            intervalUnit: port.rateLimit?.intervalUnit,
          })),
        ],
      });
    }
  }, [loading, runFunctionEnabledByDefault, ports, form]);

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

  const handleSubmit = async (formValues: RunFunctionLimitingFormValues) => {
    const updateConfigPromise = updateRunServiceRateLimit({
      variables: {
        appID: currentProject?.id,
        serviceID: serviceId,
        config: {
          ports: rawPorts.map((port, index) => {
            const { __typename, ...rest } = port;
            const rateLimit = formValues.ports[index];
            return {
              ...rest,
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
        loadingMessage: 'Updating Functions rate limit settings...',
        successMessage: 'Functions rate limit settings updated successfully',
        errorMessage: 'Failed to update Functions rate limit settings',
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
          className={twMerge('flex flex-col px-0', !enabled && 'hidden')}
        >
          <Divider />
          {ports.map((port, index) => {
            const fieldTitle = `${port.type} <-> ${port.port}`.toUpperCase();
            return (
              <RateLimitField
                title={fieldTitle}
                key={`ports.${port.port}`}
                register={register}
                errors={errors.ports}
                id={`ports.${index}`}
              />
            );
          })}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

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
import {
  useUpdateRateLimitConfigMutation,
  type ConfigConfigUpdateInput,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { RateLimitField } from 'features/projects/rate-limiting/settings/components/RateLimitField';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  rateLimit: rateLimitingItemValidationSchema,
});

export interface RateLimitDefaultValues {
  enabled: boolean;
  rateLimit: { limit: number; interval: number; intervalUnit: string };
}

export interface RateLimitingFormProps {
  defaultValues: RateLimitDefaultValues;
  serviceName: keyof ConfigConfigUpdateInput;
  title: string;
  loading: boolean;
}

export type RateLimitingFormValues = Yup.InferType<typeof validationSchema>;

export default function RateLimitingForm({
  defaultValues,
  serviceName,
  title,
  loading,
}: RateLimitingFormProps) {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const isPlatform = useIsPlatform();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();

  const [updateRateLimitConfig] = useUpdateRateLimitConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<RateLimitingFormValues>({
    defaultValues: defaultValues.enabled
      ? defaultValues
      : {
          enabled: false,
          rateLimit: {
            limit: 0,
            interval: 0,
            intervalUnit: 's',
          },
        },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && defaultValues.enabled) {
      form.reset(defaultValues);
    }
  }, [loading, defaultValues, form]);

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

  const handleSubmit = async (formValues: RateLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: currentProject.id,
        config: {
          [serviceName]: {
            rateLimit: formValues.enabled
              ? {
                  limit: formValues.rateLimit.limit,
                  interval: `${formValues.rateLimit.interval}${formValues.rateLimit.intervalUnit}`,
                }
              : null,
          },
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
        loadingMessage: `Updating ${title} rate limit settings...`,
        successMessage: `${title} rate limit settings updated successfully`,
        errorMessage: `Failed to update ${title} rate limit settings`,
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
          <RateLimitField
            disabled={!enabled}
            register={register}
            errors={errors.rateLimit}
            id="rateLimit"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

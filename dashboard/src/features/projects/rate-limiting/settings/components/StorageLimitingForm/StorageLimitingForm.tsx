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
import { useUpdateRateLimitConfigMutation } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { RateLimitField } from 'features/projects/rate-limiting/settings/components/RateLimitField';
import { useGetRateLimits } from 'features/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  storage: rateLimitingItemValidationSchema,
});

export type StorageLimitingFormValues = Yup.InferType<typeof validationSchema>;

export default function StorageLimitingForm() {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const isPlatform = useIsPlatform();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();

  const [updateRateLimitConfig] = useUpdateRateLimitConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { storageRateLimit, loading } = useGetRateLimits();
  const {
    enabled: storageEnabled,
    interval,
    intervalUnit,
    limit,
  } = storageRateLimit;

  const form = useForm<StorageLimitingFormValues>({
    defaultValues: {
      enabled: storageEnabled,
      storage: {
        limit,
        interval,
        intervalUnit,
      },
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && storageEnabled) {
      form.reset({
        enabled: storageEnabled,
        storage: {
          limit,
          interval,
          intervalUnit,
        },
      });
    }
  }, [loading, storageEnabled, interval, intervalUnit, limit, form]);

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

  const handleSubmit = async (formValues: StorageLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: currentProject.id,
        config: {
          storage: {
            rateLimit: formValues.enabled
              ? {
                  limit: formValues.storage.limit,
                  interval: `${formValues.storage.interval}${formValues.storage.intervalUnit}`,
                }
              : null,
          },
        },
      },
    });
    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;

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
        loadingMessage: 'Updating Storage rate limit settings...',
        successMessage: 'Storage rate limit settings updated successfully',
        errorMessage: 'Failed to update Storage rate limit settings',
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
          title="Storage"
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
          <RateLimitField
            register={register}
            errors={errors.storage}
            id="storage"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

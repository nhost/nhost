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
import { useUpdateRateLimitConfigMutation } from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { yupResolver } from '@hookform/resolvers/yup';
import { RateLimitField } from 'features/projects/rate-limiting/settings/components/RateLimitField';
import { useGetRateLimits } from 'features/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  bruteForce: rateLimitingItemValidationSchema,
  emails: rateLimitingItemValidationSchema,
  global: rateLimitingItemValidationSchema,
  signups: rateLimitingItemValidationSchema,
  sms: rateLimitingItemValidationSchema,
});

export type AuthLimitingFormValues = Yup.InferType<typeof validationSchema>;

export default function AuthLimitingForm() {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const isPlatform = useIsPlatform();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();

  const [updateRateLimitConfig] = useUpdateRateLimitConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { authRateLimit, loading } = useGetRateLimits();
  const {
    bruteForce,
    emails,
    global,
    signups,
    sms,
    enabled: authRateEnabled,
  } = authRateLimit;

  const {
    limit: bruteForceLimit,
    interval: bruteForceInterval,
    intervalUnit: bruteForceIntervalUnit,
  } = bruteForce;
  const {
    limit: emailsLimit,
    interval: emailsInterval,
    intervalUnit: emailsIntervalUnit,
  } = emails;
  const {
    limit: globalLimit,
    interval: globalInterval,
    intervalUnit: globalIntervalUnit,
  } = global;
  const {
    limit: signupsLimit,
    interval: signupsInterval,
    intervalUnit: signupsIntervalUnit,
  } = signups;
  const {
    limit: smsLimit,
    interval: smsInterval,
    intervalUnit: smsIntervalUnit,
  } = sms;

  const form = useForm<AuthLimitingFormValues>({
    defaultValues: {
      enabled: authRateEnabled,
      bruteForce: {
        limit: bruteForceLimit,
        interval: bruteForceInterval,
        intervalUnit: bruteForceIntervalUnit,
      },
      emails: {
        limit: emailsLimit,
        interval: emailsInterval,
        intervalUnit: emailsIntervalUnit,
      },
      global: {
        limit: globalLimit,
        interval: globalInterval,
        intervalUnit: globalIntervalUnit,
      },
      signups: {
        limit: signupsLimit,
        interval: signupsInterval,
        intervalUnit: signupsIntervalUnit,
      },
      sms: {
        limit: smsLimit,
        interval: smsInterval,
        intervalUnit: smsIntervalUnit,
      },
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && authRateEnabled) {
      form.reset({
        enabled: authRateEnabled,
        bruteForce: {
          limit: bruteForceLimit,
          interval: bruteForceInterval,
          intervalUnit: bruteForceIntervalUnit,
        },
        emails: {
          limit: emailsLimit,
          interval: emailsInterval,
          intervalUnit: emailsIntervalUnit,
        },
        global: {
          limit: globalLimit,
          interval: globalInterval,
          intervalUnit: globalIntervalUnit,
        },
        signups: {
          limit: signupsLimit,
          interval: signupsInterval,
          intervalUnit: signupsIntervalUnit,
        },
        sms: {
          limit: smsLimit,
          interval: smsInterval,
          intervalUnit: smsIntervalUnit,
        },
      });
    }
  }, [
    loading,
    form,
    authRateEnabled,
    bruteForceLimit,
    bruteForceInterval,
    bruteForceIntervalUnit,
    emailsLimit,
    emailsInterval,
    emailsIntervalUnit,
    globalLimit,
    globalInterval,
    globalIntervalUnit,
    signupsLimit,
    signupsInterval,
    signupsIntervalUnit,
    smsLimit,
    smsInterval,
    smsIntervalUnit,
  ]);

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

  const handleSubmit = async (formValues: AuthLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: currentProject.id,
        config: {
          auth: {
            rateLimit: formValues.enabled
              ? {
                  bruteForce: {
                    limit: formValues.bruteForce.limit,
                    interval: `${formValues.bruteForce.interval}${formValues.bruteForce.intervalUnit}`,
                  },
                  emails: {
                    limit: formValues.emails.limit,
                    interval: `${formValues.emails.interval}${formValues.emails.intervalUnit}`,
                  },
                  global: {
                    limit: formValues.global.limit,
                    interval: `${formValues.global.interval}${formValues.global.intervalUnit}`,
                  },
                  signups: {
                    limit: formValues.signups.limit,
                    interval: `${formValues.signups.interval}${formValues.signups.intervalUnit}`,
                  },
                  sms: {
                    limit: formValues.sms.limit,
                    interval: `${formValues.sms.interval}${formValues.sms.intervalUnit}`,
                  },
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
        loadingMessage: 'Updating Auth rate limit settings...',
        successMessage: 'Auth rate limit settings updated successfully',
        errorMessage: 'Failed to update Auth rate limit settings',
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
          title="Auth"
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
            errors={errors.bruteForce}
            id="bruteForce"
            title="Brute Force"
          />
          <Divider />
          <RateLimitField
            disabled={!enabled}
            register={register}
            errors={errors.emails}
            id="emails"
            title="Emails"
          />
          <Divider />
          <RateLimitField
            disabled={!enabled}
            register={register}
            errors={errors.global}
            id="global"
            title="Global"
          />
          <Divider />
          <RateLimitField
            disabled={!enabled}
            register={register}
            errors={errors.signups}
            id="signups"
            title="Signups"
          />
          <Divider />
          <RateLimitField
            disabled={!enabled}
            register={register}
            errors={errors.sms}
            id="sms"
            title="SMS"
          />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

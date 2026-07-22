import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RateLimitField } from '@/features/orgs/projects/rate-limiting/settings/components/RateLimitField';
import { rateLimitingItemValidationSchema } from '@/features/orgs/projects/rate-limiting/settings/components/validationSchemas';
import { useGetRateLimits } from '@/features/orgs/projects/rate-limiting/settings/hooks/useGetRateLimits';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateRateLimitConfigMutation } from '@/generated/graphql';

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
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { openDialog } = useDialog();
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

  const { formState, watch } = form;

  const enabled = watch('enabled');

  const handleSubmit = async (formValues: AuthLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: project?.id,
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
        <SettingsCard>
          <SettingsCardHeader title="Auth" />

          <SettingsCardContent className="flex flex-col px-0">
            <div className="border-t" />
            <RateLimitField
              disabled={!enabled}
              id="bruteForce"
              title="Brute Force"
            />
            <div className="border-t" />
            <RateLimitField disabled={!enabled} id="emails" title="Emails" />
            <div className="border-t" />
            <RateLimitField disabled={!enabled} id="global" title="Global" />
            <div className="border-t" />
            <RateLimitField disabled={!enabled} id="signups" title="Signups" />
            <div className="border-t" />
            <RateLimitField disabled={!enabled} id="sms" title="SMS" />
          </SettingsCardContent>

          <SettingsCardFooter>
            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}

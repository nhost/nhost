import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSwitch } from '@/components/form/FormSwitch';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type ConfigConfigUpdateInput,
  useUpdateRateLimitConfigMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';

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
  description?: string;
  loading: boolean;
}

export type RateLimitingFormValues = Yup.InferType<typeof validationSchema>;

export default function RateLimitingForm({
  defaultValues,
  serviceName,
  title,
  description,
  loading,
}: RateLimitingFormProps) {
  const { project } = useProject();
  const { openDialog } = useDialog();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const track = useTrackEvent();

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

  const { formState, watch } = form;

  const enabled = watch('enabled');

  const handleSubmit = async (formValues: RateLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: project?.id,
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
        track('Rate Limit Configured', {
          service: serviceName,
          enabled: formValues.enabled,
        });
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
        <SettingsCard>
          <SettingsCardHeader
            title="Rate limiting"
            description={description}
            contentClassName="sm:max-w-lg"
            control={
              <FormSwitch
                control={form.control}
                name="enabled"
                label={`Toggle ${title} rate limiting`}
                labelClassName="sr-only"
                containerClassName="space-y-0"
              />
            }
          />

          {/* The fields only show while the toggle is on. Hidden values stay
              in the form, and saving already ignores them when it's off. They
              also show while they have an error, so a failed save is never
              caused by a field you can't see. */}
          {(enabled || formState.errors.rateLimit) && (
            <SettingsCardContent className="flex flex-col px-0">
              <RateLimitField disabled={!enabled} id="rateLimit" />
            </SettingsCardContent>
          )}

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

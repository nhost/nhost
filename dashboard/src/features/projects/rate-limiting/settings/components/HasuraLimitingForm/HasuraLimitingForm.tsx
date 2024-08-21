import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  intervalUnitOptions,
  rateLimitingItemValidationSchema,
} from '@/features/projects/rate-limiting/settings/components/validationSchemas';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  useGetRateLimitConfigQuery,
  useUpdateRateLimitConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

export const validationSchema = Yup.object({
  enabled: Yup.boolean().label('Enabled'),
  hasura: rateLimitingItemValidationSchema,
});

export type HasuraLimitingFormValues = Yup.InferType<typeof validationSchema>;

export default function HasuraLimitingForm() {
  const { openDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const isPlatform = useIsPlatform();

  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();

  const { data, loading } = useGetRateLimitConfigQuery({
    variables: {
      appId: currentProject?.id,
    },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const [updateRateLimitConfig] = useUpdateRateLimitConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const splitIntervalNameAndUnit = (interval: string) => {
    if (!interval) {
      return {};
    }
    const regex = /^(\d+)([a-zA-Z])$/;
    const match = interval.match(regex);

    if (!match) {
      return {};
    }

    const [, intervalValue, intervalUnit] = match;
    return {
      interval: parseInt(intervalValue, 10),
      intervalUnit,
    };
  };

  const rateLimit = data?.config?.hasura?.rateLimit;

  const { limit, interval: intervalStr } = rateLimit || {};
  const { interval, intervalUnit } = splitIntervalNameAndUnit(intervalStr);

  const form = useForm<HasuraLimitingFormValues>({
    defaultValues: {
      enabled: !!rateLimit,
      hasura: {
        limit: limit || 1000,
        interval: interval || 5,
        intervalUnit: intervalUnit || 'm',
      },
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (!loading && rateLimit) {
      form.reset({
        enabled: !!rateLimit,
        hasura: {
          limit: limit || 1000,
          interval: interval || 5,
          intervalUnit: intervalUnit || 'm',
        },
      });
    }
  }, [loading, rateLimit, interval, intervalUnit, limit, form]);

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

  const handleSubmit = async (formValues: HasuraLimitingFormValues) => {
    const updateConfigPromise = updateRateLimitConfig({
      variables: {
        appId: currentProject.id,
        config: {
          hasura: {
            rateLimit: formValues.enabled
              ? {
                  limit: formValues.hasura.limit,
                  interval: `${formValues.hasura.interval}${formValues.hasura.intervalUnit}`,
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
        loadingMessage: 'Updating Hasura rate limit settings...',
        successMessage: 'Hasura rate limit settings updated successfully',
        errorMessage: 'Failed to update Hasura rate limit settings',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex h-full flex-col overflow-hidden border-t"
      >
        <SettingsContainer
          title="Hasura"
          switchId="enabled"
          showSwitch
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className={twMerge('flex flex-col', !enabled && 'hidden')}
        >
          <Box className="flex flex-row gap-8">
            <div className="flex flex-row items-center gap-2">
              <Text>Limit</Text>
              <Input
                {...register('hasura.limit')}
                id="bruteForce.limit"
                type="number"
                placeholder=""
                // inputProps={{
                //   className: 'text-right',
                // }}
                hideEmptyHelperText
                error={!!errors.hasura?.limit}
                helperText={errors?.hasura?.limit?.message}
                autoComplete="off"
                fullWidth
              />
            </div>
            <div className="grid grid-flow-row items-center gap-x-2 lg:grid-cols-7">
              <Text className="col-span-1 text-right">Interval</Text>
              <Input
                {...register('hasura.interval')}
                id="bruteForce.limit"
                type="number"
                placeholder=""
                className="col-span-1"
                hideEmptyHelperText
                error={!!errors.hasura?.interval}
                helperText={errors?.hasura?.interval?.message}
                autoComplete="off"
              />
              <ControlledSelect
                {...register('hasura.intervalUnit')}
                variant="normal"
                id="bruteForce.intervalUnit"
                defaultValue="m"
                className="col-span-1"
                hideEmptyHelperText
              >
                {intervalUnitOptions.map(({ value, label }) => (
                  <Option
                    key={`bruteForce.intervalUnit.${value}`}
                    value={value}
                  >
                    {label}
                  </Option>
                ))}
              </ControlledSelect>
            </div>
          </Box>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Text } from '@/components/ui/v2/Text';
import { Alert } from '@/components/ui/v2/Alert';
import { UpgradeNotification } from '@/features/projects/common/components/UpgradeNotification';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { getToastStyleProps } from '@/utils/constants/settings';
import { getServerError } from '@/utils/getServerError';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  capacity: Yup.number().required(),
});

export type AuthDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function AuthDomain() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const {
    data,
    loading,
    error,
    refetch: refetchPostgresSettings,
  } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const capacity =
    data?.config?.postgres?.resources?.storage?.capacity ??
    currentProject.plan.featureMaxDbSize;

  const [updateConfig] = useUpdateConfigMutation();

  const form = useForm<{ capacity: number }>({
    reValidateMode: 'onSubmit',
    defaultValues: { capacity },
    resolver: yupResolver(validationSchema),
  });

  const { formState, register, reset } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  useEffect(() => {
    if (data && !loading) {
      reset({ capacity });
    }
  }, [loading, data, reset, capacity]);

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Auth Domain Settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  async function handleSubmit(formValues: AuthDomainFormValues) {
    try {
      await toast.promise(
        updateConfig({
          variables: {
            appId: currentProject.id,
            config: {
              postgres: {
                resources: {
                  storage: {
                    capacity: formValues.capacity,
                  },
                },
              },
            },
          },
        }),
        {
          loading: `Database storage capacity is being updated...`,
          success: `Database storage capacity has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update the database storage capacity.`,
          ),
        },
        getToastStyleProps(),
      );

      form.reset(formValues);
      await refetchPostgresSettings();
    } catch {
      // Note: The toast will handle the error.
    }
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Storage capacity"
          description="Specify the storage capacity for your PostgreSQL database."
          slotProps={{
            submitButton: {
              disabled: !isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          className="flex flex-col"
        >
          {currentProject.plan.isFree && (
            <UpgradeNotification message="Unlock by upgrading your project to the Pro plan." />
          )}
          <Box className="grid grid-flow-row lg:grid-cols-5">
            <Input
              {...register('capacity')}
              id="capacity"
              name="capacity"
              type="number"
              fullWidth
              disabled={currentProject.plan.isFree}
              className="lg:col-span-2"
              error={Boolean(formState.errors.capacity?.message)}
              helperText={formState.errors.capacity?.message}
              slotProps={{
                inputRoot: {
                  min: capacity,
                },
              }}
            />
          </Box>
          {!currentProject.plan.isFree && (
              <Alert severity="info" className="col-span-6 text-left">
              Note that volumes can only be increased (not decreased). Also, due to an AWS limitation, the same volume can only be increased once every 6 hours.
              </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

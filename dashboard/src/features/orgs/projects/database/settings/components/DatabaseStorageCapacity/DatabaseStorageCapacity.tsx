import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DatabaseStorageCapacityWarning } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacityWarning';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  capacity: Yup.number().required().min(10),
});

export type DatabaseStorageCapacityFormValues = Yup.InferType<
  typeof validationSchema
>;

export default function DatabaseStorageCapacity() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { maintenanceActive } = useUI();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const {
    data,
    loading,
    error,
    refetch: refetchPostgresSettings,
  } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const capacity =
    (data?.config?.postgres?.resources?.storage?.capacity ??
      org?.plan?.featureMaxDbSize) ||
    0;

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const form = useForm<Yup.InferType<typeof validationSchema>>({
    reValidateMode: 'onSubmit',
    defaultValues: { capacity },
    resolver: yupResolver(validationSchema),
  });

  const { state } = useAppState();

  const applicationPause =
    state === ApplicationStatus.Paused || state === ApplicationStatus.Pausing;

  const { formState, register, reset, watch } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;
  const newCapacity = watch('capacity');

  const decreasingSize = newCapacity < capacity;

  const submitDisabled = useMemo(() => {
    if (!isDirty) {
      return true;
    }

    if (maintenanceActive) {
      return true;
    }

    if (decreasingSize && !applicationPause) {
      return true;
    }

    return false;
  }, [isDirty, maintenanceActive, decreasingSize, applicationPause]);

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

  async function handleSubmit(formValues: DatabaseStorageCapacityFormValues) {
    await execPromiseWithErrorToast(
      async () => {
        await updateConfig({
          variables: {
            appId: project.id,
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
        });

        form.reset(formValues);
        await refetchPostgresSettings();
      },
      {
        loadingMessage: 'Database storage capacity is being updated...',
        successMessage:
          'Database storage capacity has been updated successfully.',
        errorMessage:
          'An error occurred while trying to update the database storage capacity.',
      },
    );
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Storage capacity"
          description="Specify the storage capacity for your PostgreSQL database."
          slotProps={{
            submitButton: {
              disabled: submitDisabled,
              loading: formState.isSubmitting,
            },
          }}
          className="flex flex-col"
        >
          {project.legacyPlan?.isFree && (
            <UpgradeNotification message="Unlock by upgrading your project to the Pro plan." />
          )}
          <Box className="grid grid-flow-row lg:grid-cols-5">
            <Input
              {...register('capacity')}
              id="capacity"
              name="capacity"
              type="number"
              fullWidth
              disabled={project.legacyPlan?.isFree}
              className="lg:col-span-2"
              error={Boolean(formState.errors.capacity?.message)}
              helperText={formState.errors.capacity?.message}
              slotProps={{
                inputRoot: {
                  min: 10,
                },
              }}
            />
          </Box>
          {!project.legacyPlan?.isFree && (
            <DatabaseStorageCapacityWarning
              state={state}
              decreasingSize={decreasingSize}
              isDirty={isDirty}
            />
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

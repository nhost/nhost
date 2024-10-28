import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetPostgresSettingsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  capacity: Yup.number().required().min(10),
});

export type AuthDomainFormValues = Yup.InferType<typeof validationSchema>;

export default function AuthDomain() {
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
              disabled: !isDirty || maintenanceActive,
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
                  min: capacity,
                },
              }}
            />
          </Box>
          {!project.legacyPlan?.isFree && (
            <Alert severity="info" className="col-span-6 text-left">
              Note that volumes can only be increased (not decreased). Also, due
              to an AWS limitation, the same volume can only be increased once
              every 6 hours.
            </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

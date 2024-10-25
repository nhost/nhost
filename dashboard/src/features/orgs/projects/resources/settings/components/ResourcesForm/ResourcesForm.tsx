import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { Link } from '@/components/ui/v2/Link';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';

import { useProPlan } from '@/features/orgs/projects/common/hooks/useProPlan';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { ResourcesConfirmationDialog } from '@/features/orgs/projects/resources/settings/components/ResourcesConfirmationDialog';
import { ServiceResourcesFormFragment } from '@/features/orgs/projects/resources/settings/components/ServiceResourcesFormFragment';
import { TotalResourcesFormFragment } from '@/features/orgs/projects/resources/settings/components/TotalResourcesFormFragment';
import { calculateBillableResources } from '@/features/orgs/projects/resources/settings/utils/calculateBillableResources';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/constants/common';

import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

import type { GetResourcesQuery } from '@/utils/__generated__/graphql';
import {
  GetResourcesDocument,
  useGetResourcesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';

import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import ResourcesFormFooter from './ResourcesFormFooter';

function getInitialServiceResources(
  data: GetResourcesQuery,
  service: Exclude<keyof GetResourcesQuery['config'], '__typename'>,
) {
  const { compute, replicas } = data?.config?.[service]?.resources || {};

  return {
    replicas,
    vcpu: compute?.cpu || 0,
    memory: compute?.memory || 0,
  };
}

export default function ResourcesForm() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, closeDialog } = useDialog();
  const { project } = useProject();

  const {
    data,
    loading,
    error: resourcesError,
  } = useGetResourcesQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const {
    data: proPlan,
    loading: proPlanLoading,
    error: proPlanError,
  } = useProPlan();

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetResourcesDocument],
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const initialDatabaseResources = getInitialServiceResources(data, 'postgres');
  const initialHasuraResources = getInitialServiceResources(data, 'hasura');
  const initialAuthResources = getInitialServiceResources(data, 'auth');
  const initialStorageResources = getInitialServiceResources(data, 'storage');

  const totalInitialVCPU =
    initialDatabaseResources.vcpu +
    initialHasuraResources.vcpu +
    initialAuthResources.vcpu +
    initialStorageResources.vcpu;

  const totalInitialMemory =
    initialDatabaseResources.memory +
    initialHasuraResources.memory +
    initialAuthResources.memory +
    initialStorageResources.memory;

  const form = useForm<ResourceSettingsFormValues>({
    values: {
      enabled: totalInitialVCPU > 0 && totalInitialMemory > 0,
      totalAvailableVCPU: totalInitialVCPU || 2000,
      totalAvailableMemory: totalInitialMemory || 4096,
      database: {
        replicas: initialDatabaseResources.replicas || 1,
        vcpu: initialDatabaseResources.vcpu || 1000,
        memory: initialDatabaseResources.memory || 2048,
      },
      hasura: {
        replicas: initialHasuraResources.replicas || 1,
        vcpu: initialHasuraResources.vcpu || 500,
        memory: initialHasuraResources.memory || 1536,
      },
      auth: {
        replicas: initialAuthResources.replicas || 1,
        vcpu: initialAuthResources.vcpu || 250,
        memory: initialAuthResources.memory || 256,
      },
      storage: {
        replicas: initialStorageResources.replicas || 1,
        vcpu: initialStorageResources.vcpu || 250,
        memory: initialStorageResources.memory || 256,
      },
    },
    resolver: yupResolver(resourceSettingsValidationSchema),
  });

  if (isPlatform && !proPlan && !proPlanLoading) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the plan for this project. Please try again.
      </Alert>
    );
  }

  if (isPlatform && (loading || proPlanLoading)) {
    return (
      <ActivityIndicator
        label="Loading resource settings..."
        delay={1000}
        className="mx-auto"
      />
    );
  }

  const { watch, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;
  const hasFormErrors = Object.keys(formState.errors).length > 0;

  const enabled = watch('enabled');

  const billableResources = calculateBillableResources(
    {
      replicas: initialDatabaseResources.replicas,
      vcpu: initialDatabaseResources.vcpu,
    },
    {
      replicas: initialHasuraResources.replicas,
      vcpu: initialHasuraResources.vcpu,
    },
    {
      replicas: initialAuthResources.replicas,
      vcpu: initialAuthResources.vcpu,
    },
    {
      replicas: initialStorageResources.replicas,
      vcpu: initialStorageResources.vcpu,
    },
  );

  const initialPrice = isPlatform
    ? proPlan.price +
      (billableResources.vcpu / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE
    : 0;

  async function handleSubmit(formValues: ResourceSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          postgres: {
            resources: formValues.enabled
              ? {
                  compute: {
                    cpu: formValues.database.vcpu,
                    memory: formValues.database.memory,
                  },
                  replicas: formValues.database.replicas,
                }
              : null,
          },
          hasura: {
            resources: formValues.enabled
              ? {
                  compute: {
                    cpu: formValues.hasura.vcpu,
                    memory: formValues.hasura.memory,
                  },
                  replicas: formValues.hasura.replicas,
                }
              : null,
          },
          auth: {
            resources: formValues.enabled
              ? {
                  compute: {
                    cpu: formValues.auth.vcpu,
                    memory: formValues.auth.memory,
                  },
                  replicas: formValues.auth.replicas,
                }
              : null,
          },
          storage: {
            resources: formValues.enabled
              ? {
                  compute: {
                    cpu: formValues.storage.vcpu,
                    memory: formValues.storage.memory,
                  },
                  replicas: formValues.storage.replicas,
                }
              : null,
          },
        },
      },
    });

    try {
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
          loadingMessage: 'Updating resources...',
          successMessage: 'Resources have been updated successfully.',
          errorMessage:
            'An error occurred while updating resources. Please try again.',
        },
      );

      if (!formValues.enabled) {
        form.reset({
          enabled: false,
          totalAvailableVCPU: 2000,
          totalAvailableMemory: 4096,
          database: {
            replicas: 1,
            vcpu: 1000,
            memory: 2048,
          },
          hasura: {
            replicas: 1,
            vcpu: 500,
            memory: 1536,
          },
          auth: {
            replicas: 1,
            vcpu: 250,
            memory: 256,
          },
          storage: {
            replicas: 1,
            vcpu: 250,
            memory: 256,
          },
        });
      } else {
        form.reset(null, { keepValues: true, keepDirty: false });
      }
    } catch {
      // Note: The error has already been handled by the toast.
    }
  }

  async function handleConfirm(formValues: ResourceSettingsFormValues) {
    if (!isPlatform) {
      await handleSubmit(formValues);
      return;
    }

    openDialog({
      title: formValues.enabled
        ? 'Confirm Dedicated Resources'
        : 'Disable Dedicated Resources',
      component: (
        <ResourcesConfirmationDialog
          formValues={formValues}
          onCancel={closeDialog}
          onSubmit={async () => {
            await handleSubmit(formValues);
          }}
        />
      ),
      props: {
        titleProps: { className: 'justify-center pb-1' },
      },
    });
  }

  if (resourcesError || proPlanError) {
    throw resourcesError || proPlanError;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleConfirm}>
        <SettingsContainer
          title="Compute Resources"
          description="See how much compute you have available and customise allocation on this page."
          className="gap-0 px-0"
          showSwitch
          switchId="enabled"
          slotProps={{
            submitButton: {
              disabled: !enabled || !isDirty,
              loading: formState.isSubmitting,
            },
            // Note: We need a custom footer because of the pricing
            // information
            footer: { className: 'hidden', 'aria-hidden': true },
          }}
        >
          {enabled ? (
            <>
              <TotalResourcesFormFragment initialPrice={initialPrice} />
              <Divider />
              <ServiceResourcesFormFragment
                title="PostgreSQL Database"
                description="Manage how much compute you need for the PostgreSQL Database."
                serviceKey="database"
                disableReplicas
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Hasura GraphQL"
                description="Manage how much compute you need for the Hasura GraphQL API."
                serviceKey="hasura"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Auth"
                description="Manage how much compute you need for Auth."
                serviceKey="auth"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Storage"
                description="Manage how much compute you need for Storage."
                serviceKey="storage"
              />

              {hasFormErrors && (
                <Box className="px-4 pb-4">
                  <Alert
                    severity="error"
                    className="flex flex-col gap-2 text-left"
                  >
                    <strong>Invalid Configuration</strong>

                    <p>
                      Please check the form for errors and the allocation for
                      each service and try again.
                    </p>
                  </Alert>
                </Box>
              )}

              <Box className="px-4 pb-4">
                <Alert severity="info">
                  In case you need more resources, please reach out to us at{' '}
                  <Link href="mailto:support@nhost.io">support@nhost.io</Link>.
                </Alert>
              </Box>
            </>
          ) : (
            <Box className={twMerge('px-4', 'pb-4')}>
              <Alert className="text-left">
                Enable this feature to access custom resource allocation for
                your services.
              </Alert>
            </Box>
          )}

          <ResourcesFormFooter />
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

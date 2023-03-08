import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import ResourcesConfirmationDialog from '@/components/settings/resources/ResourcesConfirmationDialog';
import ServiceResourcesFormFragment from '@/components/settings/resources/ServiceResourcesFormFragment';
import TotalResourcesFormFragment from '@/components/settings/resources/TotalResourcesFormFragment';
import SettingsContainer from '@/components/settings/SettingsContainer';
import useProPlan from '@/hooks/common/useProPlan';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Text from '@/ui/v2/Text';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/CONSTANTS';
import getServerError from '@/utils/settings/getServerError';
import getUnallocatedResources from '@/utils/settings/getUnallocatedResources';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/utils/settings/resourceSettingsValidationSchema';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import type { GetResourcesQuery } from '@/utils/__generated__/graphql';
import {
  GetResourcesDocument,
  useGetResourcesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

function getInitialServiceResources(
  data: GetResourcesQuery,
  service: Exclude<keyof GetResourcesQuery['config'], '__typename'>,
) {
  const { cpu, memory } = data?.config?.[service]?.resources?.compute || {};

  return {
    vcpu: (cpu || 0) / RESOURCE_VCPU_MULTIPLIER,
    memory: (memory || 0) / RESOURCE_MEMORY_MULTIPLIER,
  };
}

export default function ResourcesForm() {
  const [validationError, setValidationError] = useState<Error | null>(null);

  const { openDialog, closeDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const {
    data,
    loading,
    error: resourcesError,
  } = useGetResourcesQuery({
    variables: {
      appId: currentApplication?.id,
    },
  });

  const {
    data: proPlan,
    loading: proPlanLoading,
    error: proPlanError,
  } = useProPlan();

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetResourcesDocument],
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
      totalAvailableVCPU: totalInitialVCPU || 2,
      totalAvailableMemory: totalInitialMemory || 4,
      databaseVCPU: initialDatabaseResources.vcpu || 0.5,
      databaseMemory: initialDatabaseResources.memory || 1,
      hasuraVCPU: initialHasuraResources.vcpu || 0.5,
      hasuraMemory: initialHasuraResources.memory || 1,
      authVCPU: initialAuthResources.vcpu || 0.5,
      authMemory: initialAuthResources.memory || 1,
      storageVCPU: initialStorageResources.vcpu || 0.5,
      storageMemory: initialStorageResources.memory || 1,
    },
    resolver: yupResolver(resourceSettingsValidationSchema),
  });

  if (!proPlan && !proPlanLoading) {
    return (
      <Alert severity="error">
        Couldn&apos;t load the plan for this project. Please try again.
      </Alert>
    );
  }

  if (loading || proPlanLoading) {
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

  const enabled = watch('enabled');
  const totalAvailableVCPU = enabled ? watch('totalAvailableVCPU') : 0;

  const initialPrice = RESOURCE_VCPU_PRICE * totalInitialVCPU + proPlan.price;
  const updatedPrice = RESOURCE_VCPU_PRICE * totalAvailableVCPU + proPlan.price;

  async function handleSubmit(formValues: ResourceSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication?.id,
        config: {
          postgres: {
            resources: enabled
              ? {
                  compute: {
                    cpu: formValues.databaseVCPU * RESOURCE_VCPU_MULTIPLIER,
                    memory:
                      formValues.databaseMemory * RESOURCE_MEMORY_MULTIPLIER,
                  },
                  replicas: 1,
                }
              : null,
          },
          hasura: {
            resources: enabled
              ? {
                  compute: {
                    cpu: formValues.hasuraVCPU * RESOURCE_VCPU_MULTIPLIER,
                    memory:
                      formValues.hasuraMemory * RESOURCE_MEMORY_MULTIPLIER,
                  },
                  replicas: 1,
                }
              : null,
          },
          auth: {
            resources: enabled
              ? {
                  compute: {
                    cpu: formValues.authVCPU * RESOURCE_VCPU_MULTIPLIER,
                    memory: formValues.authMemory * RESOURCE_MEMORY_MULTIPLIER,
                  },
                  replicas: 1,
                }
              : null,
          },
          storage: {
            resources: enabled
              ? {
                  compute: {
                    cpu: formValues.storageVCPU * RESOURCE_VCPU_MULTIPLIER,
                    memory:
                      formValues.storageMemory * RESOURCE_MEMORY_MULTIPLIER,
                  },
                  replicas: 1,
                }
              : null,
          },
        },
      },
    });

    try {
      await toast.promise(
        updateConfigPromise,
        {
          loading: 'Updating resources...',
          success: 'Resources have been updated successfully.',
          error: getServerError(
            'An error occurred while updating resources. Please try again.',
          ),
        },
        getToastStyleProps(),
      );

      if (!formValues.enabled) {
        form.reset({
          enabled: false,
          totalAvailableVCPU: 2,
          totalAvailableMemory: 4,
          databaseVCPU: 0.5,
          databaseMemory: 1,
          hasuraVCPU: 0.5,
          hasuraMemory: 1,
          authVCPU: 0.5,
          authMemory: 1,
          storageVCPU: 0.5,
          storageMemory: 1,
        });
      } else {
        form.reset(null, { keepValues: true, keepDirty: false });
      }
    } catch {
      // Note: The error has already been handled by the toast.
    }
  }

  function handleConfirm(formValues: ResourceSettingsFormValues) {
    setValidationError(null);

    const { vcpu: unallocatedVCPU, memory: unallocatedMemory } =
      getUnallocatedResources(formValues);
    const hasUnusedResources = unallocatedVCPU > 0 || unallocatedMemory > 0;

    if (hasUnusedResources) {
      const unusedResourceMessage = [
        unallocatedVCPU > 0 ? `${unallocatedVCPU} vCPUs` : '',
        unallocatedMemory > 0 ? `${unallocatedMemory} GiB of Memory` : '',
      ]
        .filter(Boolean)
        .join(' and ');

      setValidationError(
        new Error(
          `You now have ${unusedResourceMessage} unused. Allocate it to any of the services before saving.`,
        ),
      );

      return;
    }

    openDialog({
      title: enabled
        ? 'Confirm Dedicated Resources'
        : 'Disable Dedicated Resources',
      component: (
        <ResourcesConfirmationDialog
          updatedResources={{
            vcpu: enabled ? formValues.totalAvailableVCPU : 0,
            memory: enabled ? formValues.totalAvailableMemory : 0,
          }}
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
          title="Resources"
          description="See how much resources you have available and customise usage on this page."
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
                title="Database"
                description="Manage how much resources you need for Database."
                cpuKey="databaseVCPU"
                memoryKey="databaseMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Hasura GraphQL"
                description="Manage how much resources you need for Hasura GraphQL."
                cpuKey="hasuraVCPU"
                memoryKey="hasuraMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Auth"
                description="Manage how much resources you need for Auth."
                cpuKey="authVCPU"
                memoryKey="authMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Storage"
                description="Manage how much resources you need for Storage."
                cpuKey="storageVCPU"
                memoryKey="storageMemory"
              />
              {validationError && (
                <Box className="px-4 pb-4">
                  <Alert
                    severity="error"
                    className="flex flex-col gap-2 text-left"
                  >
                    <strong>
                      Please use all the available vCPUs and Memory
                    </strong>

                    <p>{validationError.message}</p>
                  </Alert>
                </Box>
              )}
            </>
          ) : (
            <Box className={twMerge('px-4', (enabled || isDirty) && 'pb-4')}>
              <Alert className="text-left">
                Enable this feature to access custom resource allocation for
                your services.
              </Alert>
            </Box>
          )}

          {(enabled || isDirty) && (
            <Box className="flex flex-row items-center justify-between border-t px-4 pt-4">
              <span />

              <Box className="flex flex-row items-center gap-4">
                <Text>
                  Total cost:{' '}
                  <span className="font-medium">
                    ${updatedPrice.toFixed(2)}/mo
                  </span>
                </Text>

                <Button
                  type="submit"
                  variant={isDirty ? 'contained' : 'outlined'}
                  color={isDirty ? 'primary' : 'secondary'}
                  disabled={!isDirty}
                >
                  Save
                </Button>
              </Box>
            </Box>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

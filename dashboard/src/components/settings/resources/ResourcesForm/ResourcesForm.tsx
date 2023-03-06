import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import ResourcesConfirmationDialog from '@/components/settings/resources/ResourcesConfirmationDialog';
import ServiceResourcesFormFragment from '@/components/settings/resources/ServiceResourcesFormFragment';
import TotalResourcesFormFragment from '@/components/settings/resources/TotalResourcesFormFragment';
import SettingsContainer from '@/components/settings/SettingsContainer';
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

function getServiceResources(
  data: GetResourcesQuery,
  service: Exclude<keyof GetResourcesQuery['config'], '__typename'>,
) {
  const { cpu, memory } = data?.config?.[service]?.resources?.compute || {};

  return {
    cpu: (cpu || 0) / RESOURCE_VCPU_MULTIPLIER,
    memory: (memory || 0) / RESOURCE_MEMORY_MULTIPLIER,
  };
}

export default function ResourcesForm() {
  const [validationError, setValidationError] = useState<Error | null>(null);

  const { openDialog, closeDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, error, loading } = useGetResourcesQuery({
    variables: {
      appId: currentApplication?.id,
    },
  });

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetResourcesDocument],
  });

  const databaseResources = getServiceResources(data, 'postgres');
  const hasuraResources = getServiceResources(data, 'hasura');
  const authResources = getServiceResources(data, 'auth');
  const storageResources = getServiceResources(data, 'storage');

  const totalCPU =
    databaseResources.cpu +
    hasuraResources.cpu +
    authResources.cpu +
    storageResources.cpu;

  const totalMemory =
    databaseResources.memory +
    hasuraResources.memory +
    authResources.memory +
    storageResources.memory;

  const form = useForm<ResourceSettingsFormValues>({
    values: {
      enabled: totalCPU > 0 && totalMemory > 0,
      totalAvailableCPU: totalCPU || 2,
      totalAvailableMemory: totalMemory || 4,
      databaseCPU: databaseResources.cpu || 0.5,
      databaseMemory: databaseResources.memory || 1,
      hasuraCPU: hasuraResources.cpu || 0.5,
      hasuraMemory: hasuraResources.memory || 1,
      authCPU: authResources.cpu || 0.5,
      authMemory: authResources.memory || 1,
      storageCPU: storageResources.cpu || 0.5,
      storageMemory: storageResources.memory || 1,
    },
    resolver: yupResolver(resourceSettingsValidationSchema),
  });

  const { watch, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const enabled = watch('enabled');
  const totalAvailableCPU = watch('totalAvailableCPU');

  const initialPrice =
    RESOURCE_VCPU_PRICE * totalCPU + currentApplication.plan.price;
  const updatedPrice =
    RESOURCE_VCPU_PRICE * totalAvailableCPU + currentApplication.plan.price;

  async function handleSubmit(formValues: ResourceSettingsFormValues) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentApplication?.id,
        config: {
          postgres: {
            resources: {
              compute: {
                cpu: formValues.databaseCPU * RESOURCE_VCPU_MULTIPLIER,
                memory: formValues.databaseMemory * RESOURCE_MEMORY_MULTIPLIER,
              },
              replicas: 1,
            },
          },
          hasura: {
            resources: {
              compute: {
                cpu: formValues.hasuraCPU * RESOURCE_VCPU_MULTIPLIER,
                memory: formValues.hasuraMemory * RESOURCE_MEMORY_MULTIPLIER,
              },
              replicas: 1,
            },
          },
          auth: {
            resources: {
              compute: {
                cpu: formValues.authCPU * RESOURCE_VCPU_MULTIPLIER,
                memory: formValues.authMemory * RESOURCE_MEMORY_MULTIPLIER,
              },
              replicas: 1,
            },
          },
          storage: {
            resources: {
              compute: {
                cpu: formValues.storageCPU * RESOURCE_VCPU_MULTIPLIER,
                memory: formValues.storageMemory * RESOURCE_MEMORY_MULTIPLIER,
              },
              replicas: 1,
            },
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
    } catch {
      // Note: The error has already been handled by the toast.
    }
  }

  function handleConfirm(formValues: ResourceSettingsFormValues) {
    setValidationError(null);

    const { cpu: unallocatedCPU, memory: unallocatedMemory } =
      getUnallocatedResources(formValues);
    const hasUnusedResources = unallocatedCPU > 0 || unallocatedMemory > 0;

    if (hasUnusedResources) {
      const unusedResourceMessage = [
        unallocatedCPU > 0 ? `${unallocatedCPU} vCPUs` : '',
        unallocatedMemory > 0 ? `${unallocatedMemory} GiB of memory` : '',
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
      title: 'Confirm Resources',
      component: (
        <ResourcesConfirmationDialog
          updatedResources={{
            cpu: formValues.totalAvailableCPU,
            memory: formValues.totalAvailableMemory,
          }}
          onCancel={closeDialog}
          onSubmit={() => handleSubmit(formValues)}
        />
      ),
      props: {
        titleProps: {
          className: 'justify-center',
        },
      },
    });
  }

  if (loading) {
    return (
      <ActivityIndicator
        label="Loading resource settings..."
        delay={1000}
        className="mx-auto"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleConfirm}>
        <SettingsContainer
          title="Resources"
          description="See how much resources you have available and customise usage on this page."
          className={twMerge(enabled && 'gap-0 px-0')}
          showSwitch
          switchId="enabled"
          slotProps={{
            submitButton: {
              disabled: !enabled || !isDirty,
              loading: formState.isSubmitting,
            },
            // Note: We need a custom footer because of the pricing
            // information
            footer: { className: 'hidden' },
          }}
        >
          {enabled ? (
            <>
              <TotalResourcesFormFragment initialPrice={initialPrice} />
              <Divider />
              <ServiceResourcesFormFragment
                title="Database"
                description="Manage how much resources you need for Database."
                cpuKey="databaseCPU"
                memoryKey="databaseMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Hasura GraphQL"
                description="Manage how much resources you need for Hasura GraphQL."
                cpuKey="hasuraCPU"
                memoryKey="hasuraMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Auth"
                description="Manage how much resources you need for Auth."
                cpuKey="authCPU"
                memoryKey="authMemory"
              />
              <Divider />
              <ServiceResourcesFormFragment
                title="Storage"
                description="Manage how much resources you need for Storage."
                cpuKey="storageCPU"
                memoryKey="storageMemory"
              />
              {validationError && (
                <Box className="px-4 pb-4">
                  <Alert
                    severity="error"
                    className="flex flex-col gap-2 text-left"
                  >
                    <strong>Please use all available CPU and Memory</strong>

                    <p>{validationError.message}</p>
                  </Alert>
                </Box>
              )}

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
            </>
          ) : (
            <Alert className="text-left">
              Enable this feature to access custom resource allocation for your
              services.
            </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}

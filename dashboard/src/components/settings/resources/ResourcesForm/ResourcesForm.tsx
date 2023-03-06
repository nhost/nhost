import Form from '@/components/common/Form';
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
import getUnallocatedResources from '@/utils/settings/getUnallocatedResources';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/utils/settings/resourceSettingsValidationSchema';
import type { GetResourcesQuery } from '@/utils/__generated__/graphql';
import { useGetResourcesQuery } from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

function getServiceResources(
  data: GetResourcesQuery,
  service: Exclude<keyof GetResourcesQuery['config'], '__typename'>,
) {
  return {
    cpu: (data?.config?.[service]?.resources?.compute.cpu as number) || 0,
    memory: (data?.config?.[service]?.resources?.compute.memory as number) || 0,
  };
}

export default function ResourcesForm() {
  const [validationError, setValidationError] = useState<Error | null>(null);

  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { data, error, loading } = useGetResourcesQuery({
    variables: {
      appId: currentApplication?.id,
    },
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

  function handleSubmit(formValues: ResourceSettingsFormValues) {
    setValidationError(null);

    const { cpu: unallocatedCPU, memory: unallocatedMemory } =
      getUnallocatedResources(formValues);
    const hasUnusedResources = unallocatedCPU > 0 || unallocatedMemory > 0;

    if (hasUnusedResources) {
      const unusedResourceMessage = [
        unallocatedCPU > 0 ? `${unallocatedCPU} CPU` : '',
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

    console.log(formValues);
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

  const { watch, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  const initialPrice = 50 * totalCPU + 25;
  const updatedPrice = 50 * watch('totalAvailableCPU') + 25;
  const enabled = watch('enabled');
  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Resources"
          description="See how much resources you have available and customise usage on this page."
          className={twMerge(enabled && 'gap-0 px-0')}
          showSwitch
          switchId="enabled"
          slotProps={{
            submitButton: { disabled: !enabled || !isDirty },
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
                    <span className="font-medium">${updatedPrice}/mo</span>
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

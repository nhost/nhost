import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import ResourceFormFragment from '@/components/settings/resources/ResourceFormFragment';
import TotalResourcesFormFragment from '@/components/settings/resources/TotalResourcesFormFragment';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import Text from '@/ui/v2/Text';
import getUnallocatedResources from '@/utils/settings/getUnallocatedResources';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/utils/settings/resourceSettingsValidationSchema';
import { yupResolver } from '@hookform/resolvers/yup';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export default function ResourceSettingsPage() {
  const [error, setError] = useState<Error | null>(null);
  const form = useForm<ResourceSettingsFormValues>({
    defaultValues: {
      enabled: true,
      totalAvailableCPU: 2,
      totalAvailableRAM: 4,
      databaseCPU: 0.5,
      databaseRAM: 1,
      hasuraCPU: 0.5,
      hasuraRAM: 1,
      authCPU: 0.5,
      authRAM: 1,
      storageCPU: 0.5,
      storageRAM: 1,
    },
    resolver: yupResolver(resourceSettingsValidationSchema),
  });

  const { watch, formState } = form;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  function handleSubmit(formValues: ResourceSettingsFormValues) {
    setError(null);

    const { cpu: unallocatedCPU, ram: unallocatedRAM } =
      getUnallocatedResources(formValues);
    const hasUnusedResources = unallocatedCPU > 0 || unallocatedRAM > 0;

    if (hasUnusedResources) {
      const unusedResourceMessage = [
        unallocatedCPU > 0 ? `${unallocatedCPU} CPU` : '',
        unallocatedRAM > 0 ? `${unallocatedRAM} GiB of memory` : '',
      ]
        .filter(Boolean)
        .join(' and ');

      setError(
        new Error(
          `You now have ${unusedResourceMessage} unused. Allocate it to any of the services before saving.`,
        ),
      );

      return;
    }

    console.log(formValues);
  }

  const enabled = watch('enabled');

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
      rootClassName="bg-transparent"
    >
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
                <TotalResourcesFormFragment />
                <Divider />
                <ResourceFormFragment
                  title="Database"
                  description="Manage how much resources you need for Database."
                  cpuKey="databaseCPU"
                  ramKey="databaseRAM"
                />
                <Divider />
                <ResourceFormFragment
                  title="Hasura GraphQL"
                  description="Manage how much resources you need for Hasura GraphQL."
                  cpuKey="hasuraCPU"
                  ramKey="hasuraRAM"
                />
                <Divider />
                <ResourceFormFragment
                  title="Auth"
                  description="Manage how much resources you need for Auth."
                  cpuKey="authCPU"
                  ramKey="authRAM"
                />
                <Divider />
                <ResourceFormFragment
                  title="Storage"
                  description="Manage how much resources you need for Storage."
                  cpuKey="storageCPU"
                  ramKey="storageRAM"
                />
                {error && (
                  <Box className="px-4 pb-4">
                    <Alert
                      severity="error"
                      className="flex flex-col gap-2 text-left"
                    >
                      <strong>Please use all available CPU and Memory</strong>

                      <p>{error.message}</p>
                    </Alert>
                  </Box>
                )}

                <Box className="flex flex-row items-center justify-between border-t px-4 pt-4">
                  <span />

                  <Box className="flex flex-row items-center gap-4">
                    <Text>
                      Total cost:{' '}
                      <span className="font-medium">$125.00/mo</span>
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
                Enable this feature to access custom resource allocation for
                your services.
              </Alert>
            )}
          </SettingsContainer>
        </Form>
      </FormProvider>
    </Container>
  );
}

ResourceSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};

import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import ResourceFormFragment from '@/components/settings/resources/ResourceFormFragment';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Divider from '@/ui/v2/Divider';
import Input from '@/ui/v2/Input';
import Slider, { sliderClasses } from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import {
  RESOURCE_CPU_STEP,
  RESOURCE_RAM_MULTIPLIER,
  RESOURCE_RAM_STEP,
} from '@/utils/CONSTANTS';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import {
  MAX_TOTAL_CPU,
  MAX_TOTAL_RAM,
  MIN_TOTAL_CPU,
  MIN_TOTAL_RAM,
  resourceSettingsValidationSchema,
} from '@/utils/settings/resourceSettingsValidationSchema';
import { yupResolver } from '@hookform/resolvers/yup';
import { alpha, styled } from '@mui/material';
import type { ReactElement } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

const StyledAvailableCpuSlider = styled(Slider)(({ theme }) => ({
  [`& .${sliderClasses.rail}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
}));

function TotalResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const values = useWatch<ResourceSettingsFormValues>();

  const allocatedCPU =
    values.databaseCPU + values.hasuraCPU + values.authCPU + values.storageCPU;
  const allocatedRAM =
    values.databaseRAM + values.hasuraRAM + values.authRAM + values.storageRAM;

  const unallocatedCPU = Math.max(values.totalAvailableCPU - allocatedCPU, 0);
  const unallocatedRAM = Math.max(values.totalAvailableRAM - allocatedRAM, 0);

  const hasUnusedResources = unallocatedCPU > 0 || unallocatedRAM > 0;
  const unusedResourceMessage = [
    unallocatedCPU > 0 ? `${unallocatedCPU} CPU` : '',
    unallocatedRAM > 0 ? `${unallocatedRAM} GiB of memory` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);
    const updatedRAM = updatedCPU * RESOURCE_RAM_MULTIPLIER;

    if (
      Number.isNaN(updatedCPU) ||
      updatedCPU < Math.max(MIN_TOTAL_CPU, allocatedCPU) ||
      updatedRAM < Math.max(MIN_TOTAL_RAM, allocatedRAM)
    ) {
      return;
    }

    setValue('totalAvailableCPU', updatedCPU, { shouldDirty: true });
    setValue('totalAvailableRAM', updatedRAM, { shouldDirty: true });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM) || updatedRAM < Math.max(1, allocatedRAM)) {
      return;
    }

    setValue('totalAvailableRAM', updatedRAM, { shouldDirty: true });
    setValue('totalAvailableCPU', updatedRAM / RESOURCE_RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="px-4 pb-4">
      <Box className="rounded-md border">
        <Box className="flex flex-col gap-4 bg-transparent p-4">
          <Text color="secondary">
            Total available resources for your project:
          </Text>

          <Box className="flex flex-row items-center justify-start gap-4">
            <Input
              id="totalAvailableCPU"
              value={values.totalAvailableCPU}
              onChange={(event) => handleCPUChange(event.target.value)}
              type="number"
              inputProps={{
                min: Math.max(MIN_TOTAL_CPU, allocatedCPU),
                max: MAX_TOTAL_CPU,
                step: RESOURCE_CPU_STEP,
              }}
              label="CPU:"
              variant="inline"
              slotProps={{
                label: { className: 'text-base font-normal' },
                formControl: { className: 'flex flex-row gap-2' },
                inputWrapper: { className: 'w-auto' },
                input: { className: 'w-[100px]' },
              }}
            />

            <Input
              id="totalAvailableRAM"
              value={values.totalAvailableRAM}
              onChange={(event) => handleRAMChange(event.target.value)}
              type="number"
              inputProps={{
                min: Math.max(MIN_TOTAL_RAM, allocatedRAM),
                max: MAX_TOTAL_RAM,
                step: RESOURCE_RAM_STEP,
              }}
              label="Memory:"
              variant="inline"
              slotProps={{
                label: { className: 'text-base font-normal' },
                formControl: { className: 'flex flex-row gap-2' },
                inputWrapper: { className: 'w-auto' },
                input: { className: 'w-[100px]' },
              }}
              endAdornment={<Text className="pr-2">GiB</Text>}
            />
          </Box>

          <StyledAvailableCpuSlider
            value={values.totalAvailableCPU}
            onChange={(_event, value) => handleCPUChange(value.toString())}
            min={MIN_TOTAL_CPU}
            max={MAX_TOTAL_CPU}
            step={RESOURCE_CPU_STEP}
            aria-label="Total Available CPU Slider"
          />
        </Box>

        <Alert
          severity={hasUnusedResources ? 'warning' : 'info'}
          className="flex flex-col gap-2 rounded-t-none rounded-b-[5px] p-4 text-left"
        >
          {hasUnusedResources ? (
            <>
              <strong>Please use all available CPU and RAM</strong>

              <p>
                You now have {unusedResourceMessage} unused. Allocate it to any
                of the services before saving.
              </p>
            </>
          ) : (
            <>
              <strong>All Set!</strong>

              <p>You have successfully allocated all available CPU and RAM.</p>
            </>
          )}
        </Alert>
      </Box>
    </Box>
  );
}

export default function ResourceSettingsPage() {
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

  const { watch } = form;

  function handleSubmit(formValues: ResourceSettingsFormValues) {
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
              submitButton: { disabled: !enabled },
              footer: { className: twMerge(!enabled && 'hidden') },
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
                  description="Manage how much resources you need for Hasura Auth."
                  cpuKey="authCPU"
                  ramKey="authRAM"
                />
                <Divider />
                <ResourceFormFragment
                  title="Storage"
                  description="Manage how much resources you need for Hasura Storage."
                  cpuKey="storageCPU"
                  ramKey="storageRAM"
                />
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

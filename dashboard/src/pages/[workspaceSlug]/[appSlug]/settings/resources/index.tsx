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
import { RESOURCE_RAM_MULTIPLIER } from '@/utils/CONSTANTS';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import { resourceSettingsValidationSchema } from '@/utils/settings/resourceSettingsValidationSchema';
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

const StyledTotalCPUSlider = styled(Slider)(({ theme }) => ({
  [`& .${sliderClasses.rail}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
}));

function TotalResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [totalCPU, totalRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['totalCPU', 'totalRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('totalCPU', updatedCPU, { shouldDirty: true });
    setValue('totalRAM', updatedCPU * RESOURCE_RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('totalRAM', updatedRAM, { shouldDirty: true });
    setValue('totalCPU', updatedRAM / RESOURCE_RAM_MULTIPLIER, {
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
              id="totalCPU"
              value={totalCPU}
              onChange={(event) => handleCPUChange(event.target.value)}
              type="number"
              inputProps={{
                min: 1,
                max: 60,
                step: 0.25,
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
              id="totalRAM"
              value={totalRAM}
              onChange={(event) => handleRAMChange(event.target.value)}
              type="number"
              inputProps={{
                min: 1 * RESOURCE_RAM_MULTIPLIER,
                max: 60 * RESOURCE_RAM_MULTIPLIER,
                step: 0.25 * RESOURCE_RAM_MULTIPLIER,
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

          <StyledTotalCPUSlider
            value={totalCPU}
            onChange={(_event, value) => handleCPUChange(value.toString())}
            min={1}
            max={60}
            step={0.25}
            aria-label="Total CPU Slider"
          />
        </Box>

        <Alert className="flex flex-col gap-2 rounded-b-md p-4 text-left">
          <strong>Please use all available CPU & Memory</strong>

          <p>
            You now have N CPU & M GB of memory unused. Allocate it to any of
            the services before saving.
          </p>
        </Alert>
      </Box>
    </Box>
  );
}

export default function ResourceSettingsPage() {
  const form = useForm<ResourceSettingsFormValues>({
    defaultValues: {
      enabled: true,
      totalCPU: 2,
      totalRAM: 4,
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

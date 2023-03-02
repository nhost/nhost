import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Input from '@/ui/v2/Input';
import Slider from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import type { ReactElement } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import * as Yup from 'yup';

/**
 * For every CPU, we allocate N times the amount of RAM.
 */
const RAM_MULTIPLIER = 2;

const validationSchema = Yup.object({
  enabled: Yup.boolean(),
  totalCPU: Yup.number().label('Total CPU').required().min(1).max(60),
  totalRAM: Yup.number().label('Total RAM').required().min(1).max(120),
});

export type ResourceSettingsFormValues = Yup.InferType<typeof validationSchema>;

function ResourceSettingsForm() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [totalCPU, totalRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['totalCPU', 'totalRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedTotalCPU = parseFloat(value);

    if (Number.isNaN(updatedTotalCPU)) {
      return;
    }

    setValue('totalCPU', updatedTotalCPU, { shouldDirty: true });
    setValue('totalRAM', updatedTotalCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedTotalRAM = parseFloat(value);

    if (Number.isNaN(updatedTotalRAM)) {
      return;
    }

    setValue('totalRAM', updatedTotalRAM, { shouldDirty: true });
    setValue('totalCPU', updatedTotalRAM / RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="px-4">
      <Box className="rounded-md border">
        <Box className=" flex flex-col gap-4 bg-transparent p-4">
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
              }}
            />

            <Input
              id="totalRAM"
              value={totalRAM}
              onChange={(event) => handleRAMChange(event.target.value)}
              type="number"
              inputProps={{
                min: 1 * RAM_MULTIPLIER,
                max: 60 * RAM_MULTIPLIER,
                step: 0.25 * RAM_MULTIPLIER,
              }}
              label="Memory:"
              variant="inline"
              slotProps={{
                label: { className: 'text-base font-normal' },
                formControl: { className: 'flex flex-row gap-2' },
                inputWrapper: { className: 'w-auto' },
              }}
              endAdornment={<Text className="pr-2">GB</Text>}
            />
          </Box>

          <Slider
            value={totalCPU}
            onChange={(_event, value) => handleCPUChange(value.toString())}
            min={1}
            max={60}
            step={0.25}
            aria-label="Total CPU"
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
      enabled: false,
      totalCPU: 2,
      totalRAM: 4,
    },
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
            className={twMerge(enabled && 'px-0')}
            showSwitch
            switchId="enabled"
            slotProps={{
              submitButton: { disabled: !enabled },
              footer: { className: twMerge(!enabled && 'hidden') },
            }}
          >
            {enabled ? (
              <ResourceSettingsForm />
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

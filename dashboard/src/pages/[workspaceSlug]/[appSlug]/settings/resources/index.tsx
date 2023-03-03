import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import Divider from '@/ui/v2/Divider';
import Input from '@/ui/v2/Input';
import Slider, { sliderClasses } from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import { alpha, styled } from '@mui/material';
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
  databaseCPU: Yup.number().label('Database CPU').required().min(0.25),
  databaseRAM: Yup.number().label('Database RAM').required().min(0.5),
  hasuraCPU: Yup.number().label('Hasura CPU').required().min(0.25),
  hasuraRAM: Yup.number().label('Hasura RAM').required().min(0.5),
  authCPU: Yup.number().label('Auth CPU').required().min(0.25),
  authRAM: Yup.number().label('Auth RAM').required().min(0.5),
  storageCPU: Yup.number().label('Storage CPU').required().min(0.25),
  storageRAM: Yup.number().label('Storage RAM').required().min(0.5),
});

export type ResourceSettingsFormValues = Yup.InferType<typeof validationSchema>;

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
    setValue('totalRAM', updatedCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('totalRAM', updatedRAM, { shouldDirty: true });
    setValue('totalCPU', updatedRAM / RAM_MULTIPLIER, {
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

function DatabaseResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [databaseCPU, databaseRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['databaseCPU', 'databaseRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('databaseCPU', updatedCPU, { shouldDirty: true });
    setValue('databaseRAM', updatedCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('databaseRAM', updatedRAM, { shouldDirty: true });
    setValue('databaseCPU', updatedRAM / RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-col gap-2">
        <Text variant="h3" className="font-semibold">
          Database
        </Text>

        <Text color="secondary">
          Manage how much resources you need for Database.
        </Text>
      </Box>

      <Box className="flex flex-row items-center justify-start gap-4">
        <Input
          id="databaseCPU"
          value={databaseCPU}
          onChange={(event) => handleCPUChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25,
            max: 15,
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
          id="databaseRAM"
          value={databaseRAM}
          onChange={(event) => handleRAMChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25 * RAM_MULTIPLIER,
            max: 15 * RAM_MULTIPLIER,
            step: 0.25 * RAM_MULTIPLIER,
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

      <Slider
        value={databaseCPU}
        onChange={(_event, value) => handleCPUChange(value.toString())}
        min={0.25}
        max={15}
        step={0.25}
        aria-label="Database CPU Slider"
        marks
      />
    </Box>
  );
}

function HasuraResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [hasuraCPU, hasuraRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['hasuraCPU', 'hasuraRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('hasuraCPU', updatedCPU, { shouldDirty: true });
    setValue('hasuraRAM', updatedCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('hasuraRAM', updatedRAM, { shouldDirty: true });
    setValue('hasuraCPU', updatedRAM / RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-col gap-2">
        <Text variant="h3" className="font-semibold">
          Hasura GraphQL
        </Text>

        <Text color="secondary">
          Manage how much resources you need for Hasura GraphQL.
        </Text>
      </Box>

      <Box className="flex flex-row items-center justify-start gap-4">
        <Input
          id="hasuraCPU"
          value={hasuraCPU}
          onChange={(event) => handleCPUChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25,
            max: 15,
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
          id="hasuraRAM"
          value={hasuraRAM}
          onChange={(event) => handleRAMChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25 * RAM_MULTIPLIER,
            max: 15 * RAM_MULTIPLIER,
            step: 0.25 * RAM_MULTIPLIER,
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

      <Slider
        value={hasuraCPU}
        onChange={(_event, value) => handleCPUChange(value.toString())}
        min={0.25}
        max={15}
        step={0.25}
        aria-label="Hasura GraphQL CPU Slider"
        marks
      />
    </Box>
  );
}

function AuthResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [authCPU, authRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['authCPU', 'authRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('authCPU', updatedCPU, { shouldDirty: true });
    setValue('authRAM', updatedCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('authRAM', updatedRAM, { shouldDirty: true });
    setValue('authCPU', updatedRAM / RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-col gap-2">
        <Text variant="h3" className="font-semibold">
          Auth
        </Text>

        <Text color="secondary">
          Manage how much resources you need for Auth.
        </Text>
      </Box>

      <Box className="flex flex-row items-center justify-start gap-4">
        <Input
          id="authCPU"
          value={authCPU}
          onChange={(event) => handleCPUChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25,
            max: 15,
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
          id="authRAM"
          value={authRAM}
          onChange={(event) => handleRAMChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25 * RAM_MULTIPLIER,
            max: 15 * RAM_MULTIPLIER,
            step: 0.25 * RAM_MULTIPLIER,
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

      <Slider
        value={authCPU}
        onChange={(_event, value) => handleCPUChange(value.toString())}
        min={0.25}
        max={15}
        step={0.25}
        aria-label="Auth CPU Slider"
        marks
      />
    </Box>
  );
}

function StorageResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const [storageCPU, storageRAM] = useWatch<ResourceSettingsFormValues>({
    name: ['storageCPU', 'storageRAM'],
  }) as [number, number];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('storageCPU', updatedCPU, { shouldDirty: true });
    setValue('storageRAM', updatedCPU * RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  function handleRAMChange(value: string) {
    const updatedRAM = parseFloat(value);

    if (Number.isNaN(updatedRAM)) {
      return;
    }

    setValue('storageRAM', updatedRAM, { shouldDirty: true });
    setValue('storageCPU', updatedRAM / RAM_MULTIPLIER, {
      shouldDirty: true,
    });
  }

  return (
    <Box className="flex flex-col gap-4 p-4">
      <Box className="flex flex-col gap-2">
        <Text variant="h3" className="font-semibold">
          Storage
        </Text>

        <Text color="secondary">
          Manage how much resources you need for Storage.
        </Text>
      </Box>

      <Box className="flex flex-row items-center justify-start gap-4">
        <Input
          id="storageCPU"
          value={storageCPU}
          onChange={(event) => handleCPUChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25,
            max: 15,
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
          id="storageRAM"
          value={storageRAM}
          onChange={(event) => handleRAMChange(event.target.value)}
          type="number"
          inputProps={{
            min: 0.25 * RAM_MULTIPLIER,
            max: 15 * RAM_MULTIPLIER,
            step: 0.25 * RAM_MULTIPLIER,
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

      <Slider
        value={storageCPU}
        onChange={(_event, value) => handleCPUChange(value.toString())}
        min={0.25}
        max={15}
        step={0.25}
        aria-label="Auth CPU Slider"
        marks
      />
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
                <DatabaseResourcesFormFragment />
                <Divider />
                <HasuraResourcesFormFragment />
                <Divider />
                <AuthResourcesFormFragment />
                <Divider />
                <StorageResourcesFormFragment />
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

import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { MEM_CPU_RATIO } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import type { CreateServiceFormValues } from '@/features/run/components/CreateServiceForm';
import { useFormContext, useWatch } from 'react-hook-form';

export default function ComputeFormSection() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<CreateServiceFormValues>();

  const formValues = useWatch<CreateServiceFormValues>();

  const handleSliderUpdate = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem) || updatedMem < 14000) {
      return;
    }

    setValue('compute.memory', Math.floor(updatedMem), { shouldDirty: true });
    setValue('compute.cpu', Math.floor(updatedMem / 2), {
      shouldDirty: true,
    });
  };

  const handleCPUInputValueChange = (value: string) => {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      return;
    }

    setValue('compute.memory', Math.floor(updatedCPU * MEM_CPU_RATIO));
  };

  const checkCPUBounds = (value: string) => {
    const updatedCPU = parseFloat(value);

    if (Number.isNaN(updatedCPU)) {
      setValue('compute.cpu', 64);
      setValue('compute.memory', 128);
      return;
    }

    if (updatedCPU < 64) {
      setValue('compute.cpu', 64);
      setValue('compute.memory', 128);
      return;
    }

    if (updatedCPU > 7000) {
      setValue('compute.cpu', 7000);
      setValue('compute.memory', 14000);
    }
  };

  const handleMemoryInputValueChange = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem)) {
      return;
    }

    setValue('compute.cpu', Math.floor(updatedMem / MEM_CPU_RATIO));
  };

  const checkMemBounds = (value: string) => {
    const updatedMem = parseFloat(value);

    if (Number.isNaN(updatedMem)) {
      setValue('compute.cpu', 64);
      setValue('compute.memory', 128);
      return;
    }

    if (updatedMem < 128) {
      setValue('compute.cpu', 7000);
      setValue('compute.memory', 14000);
      return;
    }

    if (updatedMem > 14000) {
      setValue('compute.cpu', 7000);
      setValue('compute.memory', 14000);
    }
  };

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-row items-center space-x-2">
        <Text variant="h4" className="font-semibold">
          Compute
        </Text>

        <Tooltip title="Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s">
          <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
        </Tooltip>
      </Box>

      <Box className="flex flex-row space-x-2">
        <Input
          {...register('compute.cpu', {
            onChange: (event) => handleCPUInputValueChange(event.target.value),
            onBlur: (event) => checkCPUBounds(event.target.value),
          })}
          id="compute.cpu"
          label="CPU"
          className="w-full"
          hideEmptyHelperText
          error={!!errors?.compute?.cpu}
          helperText={errors?.compute?.cpu.message}
          fullWidth
          autoComplete="off"
          type="number"
          slotProps={{
            inputRoot: {
              step: 64,
            },
          }}
        />
        <Input
          {...register('compute.memory', {
            onChange: (event) =>
              handleMemoryInputValueChange(event.target.value),
            onBlur: (event) => checkMemBounds(event.target.value),
          })}
          id="compute.memory"
          label="Memory"
          className="w-full"
          hideEmptyHelperText
          error={!!errors?.compute?.memory}
          helperText={errors?.compute?.memory?.message}
          fullWidth
          autoComplete="off"
          type="number"
          slotProps={{
            inputRoot: {
              step: 128,
            },
          }}
        />
      </Box>
      <Slider
        value={formValues.compute.memory}
        onChange={(_event, value) => handleSliderUpdate(value.toString())}
        max={14000}
        min={128}
        step={256}
        aria-label="Compute resources"
        marks
      />
    </Box>
  );
}

import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import Input from '@/ui/v2/Input';
import Slider, { sliderClasses } from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import {
  RESOURCE_CPU_STEP,
  RESOURCE_RAM_MULTIPLIER,
  RESOURCE_RAM_STEP,
} from '@/utils/CONSTANTS';
import getUnallocatedResources from '@/utils/settings/getUnallocatedResources';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import {
  MAX_TOTAL_CPU,
  MAX_TOTAL_RAM,
  MIN_TOTAL_CPU,
  MIN_TOTAL_RAM,
} from '@/utils/settings/resourceSettingsValidationSchema';
import { alpha, styled } from '@mui/material';
import { useFormContext, useWatch } from 'react-hook-form';

const StyledAvailableCpuSlider = styled(Slider)(({ theme }) => ({
  [`& .${sliderClasses.rail}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
}));

export default function TotalResourcesFormFragment() {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const formValues = useWatch<ResourceSettingsFormValues>();

  const allocatedCPU =
    formValues.databaseCPU +
    formValues.hasuraCPU +
    formValues.authCPU +
    formValues.storageCPU;
  const allocatedRAM =
    formValues.databaseRAM +
    formValues.hasuraRAM +
    formValues.authRAM +
    formValues.storageRAM;

  const { cpu: unallocatedCPU, ram: unallocatedRAM } =
    getUnallocatedResources(formValues);

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
          <Box className="flex flex-row items-center justify-between gap-4">
            <Text color="secondary">
              Total available resources for your project:
            </Text>

            <Text className="flex flex-row items-center justify-end gap-2">
              <Text component="span" color="secondary">
                $25.00/mo
              </Text>
              <ArrowRightIcon />
              <Text component="span" className="font-medium">
                $125.00/mo
              </Text>
            </Text>
          </Box>

          <Box className="flex flex-row items-center justify-start gap-4">
            <Input
              id="totalAvailableCPU"
              value={formValues.totalAvailableCPU}
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
              value={formValues.totalAvailableRAM}
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
                input: { className: 'w-[110px]' },
              }}
              endAdornment={<Text className="pr-2 font-medium">GiB</Text>}
            />
          </Box>

          <StyledAvailableCpuSlider
            value={formValues.totalAvailableCPU}
            onChange={(_event, value) => handleCPUChange(value.toString())}
            max={MAX_TOTAL_CPU}
            step={RESOURCE_CPU_STEP}
            aria-label="Total Available CPU Slider"
          />
        </Box>

        <Alert
          severity={hasUnusedResources ? 'warning' : 'info'}
          className="flex flex-col gap-2 rounded-t-none rounded-b-[5px] text-left"
        >
          {hasUnusedResources ? (
            <>
              <strong>Please use all available CPU and Memory</strong>

              <p>
                You now have {unusedResourceMessage} unused. Allocate it to any
                of the services before saving.
              </p>
            </>
          ) : (
            <>
              <strong>All Set!</strong>

              <p>
                You have successfully allocated all available CPU and Memory.
              </p>
            </>
          )}
        </Alert>
      </Box>
    </Box>
  );
}

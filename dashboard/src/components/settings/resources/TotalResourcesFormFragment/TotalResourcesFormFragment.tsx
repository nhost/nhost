import { Alert } from '@/ui/Alert';
import Box from '@/ui/v2/Box';
import ArrowRightIcon from '@/ui/v2/icons/ArrowRightIcon';
import Input from '@/ui/v2/Input';
import Slider, { sliderClasses } from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import {
  RESOURCE_CPU_MEMORY_RATIO,
  RESOURCE_CPU_STEP,
  RESOURCE_MEMORY_STEP,
} from '@/utils/CONSTANTS';
import getUnallocatedResources from '@/utils/settings/getUnallocatedResources';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import {
  MAX_TOTAL_CPU,
  MAX_TOTAL_MEMORY,
  MIN_TOTAL_CPU,
  MIN_TOTAL_MEMORY,
} from '@/utils/settings/resourceSettingsValidationSchema';
import { alpha, styled } from '@mui/material';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';

export interface TotalResourcesFormFragmentProps {
  /**
   * The initial price of the resources.
   */
  initialPrice: number;
}

const StyledAvailableCpuSlider = styled(Slider)(({ theme }) => ({
  [`& .${sliderClasses.rail}`]: {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
}));

export default function TotalResourcesFormFragment({
  initialPrice,
}: TotalResourcesFormFragmentProps) {
  const { dirtyFields } = useFormState<ResourceSettingsFormValues>();
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const formValues = useWatch<ResourceSettingsFormValues>();

  const allocatedCPU =
    formValues.databaseCPU +
    formValues.hasuraCPU +
    formValues.authCPU +
    formValues.storageCPU;
  const allocatedMemory =
    formValues.databaseMemory +
    formValues.hasuraMemory +
    formValues.authMemory +
    formValues.storageMemory;

  const updatedPrice = 50 * formValues.totalAvailableCPU + 25;

  const { cpu: unallocatedCPU, memory: unallocatedMemory } =
    getUnallocatedResources(formValues);

  const showAlert =
    Object.keys(dirtyFields).filter((key) => key !== 'enabled').length > 0;
  const hasUnusedResources = unallocatedCPU > 0 || unallocatedMemory > 0;
  const unusedResourceMessage = [
    unallocatedCPU > 0 ? `${unallocatedCPU} vCPUs` : '',
    unallocatedMemory > 0 ? `${unallocatedMemory} GiB of memory` : '',
  ]
    .filter(Boolean)
    .join(' and ');

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);
    const updatedMemory = updatedCPU * RESOURCE_CPU_MEMORY_RATIO;

    if (
      Number.isNaN(updatedCPU) ||
      updatedCPU < Math.max(MIN_TOTAL_CPU, allocatedCPU) ||
      updatedMemory < Math.max(MIN_TOTAL_MEMORY, allocatedMemory)
    ) {
      return;
    }

    setValue('totalAvailableCPU', updatedCPU, { shouldDirty: true });
    setValue('totalAvailableMemory', updatedMemory, { shouldDirty: true });
  }

  function handleMemoryChange(value: string) {
    const updatedMemory = parseFloat(value);

    if (
      Number.isNaN(updatedMemory) ||
      updatedMemory < Math.max(1, allocatedMemory)
    ) {
      return;
    }

    setValue('totalAvailableMemory', updatedMemory, { shouldDirty: true });
    setValue('totalAvailableCPU', updatedMemory / RESOURCE_CPU_MEMORY_RATIO, {
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

            {initialPrice !== updatedPrice && (
              <Text className="flex flex-row items-center justify-end gap-2">
                <Text component="span" color="secondary">
                  ${initialPrice}/mo
                </Text>
                <ArrowRightIcon />
                <Text component="span" className="font-medium">
                  ${updatedPrice}/mo
                </Text>
              </Text>
            )}
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
              label="vCPUs:"
              variant="inline"
              slotProps={{
                label: { className: 'text-base font-normal' },
                formControl: { className: 'flex flex-row gap-2' },
                inputWrapper: { className: 'w-auto' },
                input: { className: 'w-[100px]' },
              }}
            />

            <Input
              id="totalAvailableMemory"
              value={formValues.totalAvailableMemory}
              onChange={(event) => handleMemoryChange(event.target.value)}
              type="number"
              inputProps={{
                min: Math.max(MIN_TOTAL_MEMORY, allocatedMemory),
                max: MAX_TOTAL_MEMORY,
                step: RESOURCE_MEMORY_STEP,
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
            aria-label="Total Available vCPU Slider"
          />
        </Box>

        {showAlert && (
          <Alert
            severity={hasUnusedResources ? 'warning' : 'info'}
            className="flex flex-col gap-2 rounded-t-none rounded-b-[5px] text-left"
          >
            {hasUnusedResources ? (
              <>
                <strong>Please use all the available vCPUs and Memory</strong>

                <p>
                  You now have {unusedResourceMessage} unused. Allocate it to
                  any of the services before saving.
                </p>
              </>
            ) : (
              <>
                <strong>All Set!</strong>

                <p>
                  You have successfully allocated all the available vCPUs and
                  Memory.
                </p>
              </>
            )}
          </Alert>
        )}
      </Box>
    </Box>
  );
}

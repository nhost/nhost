import Box from '@/ui/v2/Box';
import Slider from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import { RESOURCE_CPU_STEP, RESOURCE_MEMORY_STEP } from '@/utils/CONSTANTS';
import type { ResourceSettingsFormValues } from '@/utils/settings/resourceSettingsValidationSchema';
import {
  MAX_SERVICE_CPU,
  MAX_SERVICE_MEMORY,
  MIN_SERVICE_CPU,
  MIN_SERVICE_MEMORY,
} from '@/utils/settings/resourceSettingsValidationSchema';
import { useFormContext, useWatch } from 'react-hook-form';

export interface ResourceFormFragmentProps {
  /**
   * The title of the form fragment.
   */
  title: string;
  /**
   * The description of the form fragment.
   */
  description: string;
  /**
   * Form field name for CPU.
   */
  cpuKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableCPU' | 'totalAvailableMemory'
  >;
  /**
   * Form field name for Memory.
   */
  memoryKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableCPU' | 'totalAvailableMemory'
  >;
}

export default function ResourceFormFragment({
  title,
  description,
  cpuKey,
  memoryKey,
}: ResourceFormFragmentProps) {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const formValues = useWatch<ResourceSettingsFormValues>();

  // Total allocated CPU for all resources
  const totalAllocatedCPU = Object.keys(formValues)
    .filter((key) => key.endsWith('CPU') && key !== 'totalAvailableCPU')
    .reduce((acc, key) => acc + formValues[key], 0);

  // Total allocated memory for all resources
  const totalAllocatedMemory = Object.keys(formValues)
    .filter((key) => key.endsWith('Memory') && key !== 'totalAvailableMemory')
    .reduce((acc, key) => acc + formValues[key], 0);

  const remainingCPU = formValues.totalAvailableCPU - totalAllocatedCPU;
  const allowedCPU = remainingCPU + formValues[cpuKey];

  const remainingMemory =
    formValues.totalAvailableMemory - totalAllocatedMemory;
  const allowedMemory = remainingMemory + formValues[memoryKey];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);
    const exceedsAvailableCPU =
      updatedCPU + (totalAllocatedCPU - formValues[cpuKey]) >
      formValues.totalAvailableCPU;

    if (
      Number.isNaN(updatedCPU) ||
      exceedsAvailableCPU ||
      updatedCPU < MIN_SERVICE_CPU
    ) {
      return;
    }

    setValue(cpuKey, updatedCPU, { shouldDirty: true });
  }

  function handleMemoryChange(value: string) {
    const updatedMemory = parseFloat(value);
    const exceedsAvailableMemory =
      updatedMemory + (totalAllocatedMemory - formValues[memoryKey]) >
      formValues.totalAvailableMemory;

    if (
      Number.isNaN(updatedMemory) ||
      exceedsAvailableMemory ||
      updatedMemory < MIN_SERVICE_MEMORY
    ) {
      return;
    }

    setValue(memoryKey, updatedMemory, { shouldDirty: true });
  }

  return (
    <Box className="grid grid-flow-row gap-4 p-4">
      <Box className="grid grid-flow-row gap-2">
        <Text variant="h3" className="font-semibold">
          {title}
        </Text>

        <Text color="secondary">{description}</Text>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Text>
            Allocated CPU:{' '}
            <span className="font-medium">{formValues[cpuKey]}</span>
          </Text>

          {remainingCPU > 0 && (
            <Text className="text-sm">
              <span className="font-medium">{remainingCPU} CPU</span> remaining
            </Text>
          )}
        </Box>

        <Slider
          value={formValues[cpuKey]}
          onChange={(_event, value) => handleCPUChange(value.toString())}
          max={MAX_SERVICE_CPU}
          step={RESOURCE_CPU_STEP}
          allowed={allowedCPU}
          aria-label={`${title} CPU Slider`}
          marks
        />
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Text>
            Allocated Memory:{' '}
            <span className="font-medium">{formValues[memoryKey]} GiB</span>
          </Text>

          {remainingMemory > 0 && formValues[memoryKey] < MAX_SERVICE_MEMORY && (
            <Text className="text-sm">
              <span className="font-medium">
                {remainingMemory} GiB of memory
              </span>{' '}
              remaining
            </Text>
          )}
        </Box>

        <Slider
          value={formValues[memoryKey]}
          onChange={(_event, value) => handleMemoryChange(value.toString())}
          max={MAX_SERVICE_MEMORY}
          step={RESOURCE_MEMORY_STEP}
          allowed={allowedMemory}
          aria-label={`${title} Memory Slider`}
          marks
        />
      </Box>
    </Box>
  );
}

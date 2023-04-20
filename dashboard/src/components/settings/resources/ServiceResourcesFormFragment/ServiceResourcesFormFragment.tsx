import { prettifyMemory } from '@/features/settings/resources/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/settings/resources/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/settings/resources/utils/resourceSettingsValidationSchema';
import {
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_REPLICAS,
  MAX_SERVICE_VCPU,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_REPLICAS,
  MIN_SERVICE_VCPU,
} from '@/features/settings/resources/utils/resourceSettingsValidationSchema';
import Box from '@/ui/v2/Box';
import Slider from '@/ui/v2/Slider';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import { InfoIcon } from '@/ui/v2/icons/InfoIcon';
import { RESOURCE_MEMORY_STEP, RESOURCE_VCPU_STEP } from '@/utils/CONSTANTS';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';

export interface ServiceResourcesFormFragmentProps {
  /**
   * The title of the form fragment.
   */
  title: string;
  /**
   * The description of the form fragment.
   */
  description: string;
  /**
   * Form field name for replica count.
   */
  replicaKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableVCPU' | 'totalAvailableMemory'
  >;
  /**
   * Form field name for CPU.
   */
  cpuKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableVCPU' | 'totalAvailableMemory'
  >;
  /**
   * Form field name for Memory.
   */
  memoryKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableVCPU' | 'totalAvailableMemory'
  >;
}

export default function ServiceResourcesFormFragment({
  title,
  description,
  replicaKey,
  cpuKey,
  memoryKey,
}: ServiceResourcesFormFragmentProps) {
  const { setValue } = useFormContext<ResourceSettingsFormValues>();
  const formState = useFormState<ResourceSettingsFormValues>();
  const formValues = useWatch<ResourceSettingsFormValues>();

  // Total allocated CPU for all resources
  const totalAllocatedCPU = Object.keys(formValues)
    .filter((key) => key.endsWith('CPU') && key !== 'totalAvailableVCPU')
    .reduce((acc, key) => acc + formValues[key], 0);

  // Total allocated memory for all resources
  const totalAllocatedMemory = Object.keys(formValues)
    .filter((key) => key.endsWith('Memory') && key !== 'totalAvailableMemory')
    .reduce((acc, key) => acc + formValues[key], 0);

  const remainingCPU = formValues.totalAvailableVCPU - totalAllocatedCPU;
  const allowedCPU = remainingCPU + formValues[cpuKey];

  const remainingMemory =
    formValues.totalAvailableMemory - totalAllocatedMemory;
  const allowedMemory = remainingMemory + formValues[memoryKey];

  function handleCPUChange(value: string) {
    const updatedCPU = parseFloat(value);
    const exceedsAvailableCPU =
      updatedCPU + (totalAllocatedCPU - formValues[cpuKey]) >
      formValues.totalAvailableVCPU;

    if (
      Number.isNaN(updatedCPU) ||
      exceedsAvailableCPU ||
      updatedCPU < MIN_SERVICE_VCPU
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
        <Box className="grid grid-flow-col items-center justify-start gap-2">
          <Text>
            Replicas:{' '}
            <span className="font-medium">{formValues[replicaKey]}</span>
          </Text>

          {formState.errors?.[memoryKey]?.message ? (
            <Tooltip title={formState.errors[memoryKey].message}>
              <InfoIcon color="error" className="h-4 w-4" />
            </Tooltip>
          ) : null}
        </Box>

        <Slider
          value={formValues[replicaKey]}
          onChange={(_event, value) => {
            if (Array.isArray(value)) {
              if (value[0] < MIN_SERVICE_REPLICAS) {
                return;
              }

              setValue(replicaKey, value[0], { shouldDirty: true });

              return;
            }

            if (value < MIN_SERVICE_REPLICAS) {
              return;
            }

            setValue(replicaKey, value, { shouldDirty: true });
          }}
          min={0}
          max={MAX_SERVICE_REPLICAS}
          step={1}
          aria-label={`${title} Replicas`}
          marks
        />
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Text>
            Allocated vCPUs:{' '}
            <span className="font-medium">
              {prettifyVCPU(formValues[cpuKey])}
            </span>
          </Text>

          {remainingCPU > 0 && formValues[cpuKey] < MAX_SERVICE_VCPU && (
            <Text className="text-sm">
              <span className="font-medium">
                {prettifyVCPU(remainingCPU)} vCPUs
              </span>{' '}
              remaining
            </Text>
          )}
        </Box>

        <Slider
          value={formValues[cpuKey]}
          onChange={(_event, value) => handleCPUChange(value.toString())}
          max={MAX_SERVICE_VCPU}
          step={RESOURCE_VCPU_STEP}
          allowed={allowedCPU}
          aria-label={`${title} vCPU`}
          marks
        />
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Box className="grid grid-flow-col items-center justify-between gap-2">
          <Text>
            Allocated Memory:{' '}
            <span className="font-medium">
              {prettifyMemory(formValues[memoryKey])}
            </span>
          </Text>

          {remainingMemory > 0 && formValues[memoryKey] < MAX_SERVICE_MEMORY && (
            <Text className="text-sm">
              <span className="font-medium">
                {prettifyMemory(remainingMemory)} of Memory
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
          aria-label={`${title} Memory`}
          marks
        />
      </Box>
    </Box>
  );
}

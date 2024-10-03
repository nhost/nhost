import { Box } from '@/components/ui/v2/Box';
import { ExclamationIcon } from '@/components/ui/v2/icons/ExclamationIcon';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_REPLICAS,
  MAX_SERVICE_VCPU,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_REPLICAS,
  MIN_SERVICE_VCPU,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_MEMORY_STEP,
  RESOURCE_VCPU_STEP,
} from '@/utils/constants/common';
import { useFormContext, useWatch } from 'react-hook-form';

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
   * Form field name for service.
   */
  serviceKey: Exclude<
    keyof ResourceSettingsFormValues,
    'enabled' | 'totalAvailableVCPU' | 'totalAvailableMemory'
  >;
  /**
   * Whether to disable the replicas field.
   */
  disableReplicas?: boolean;
}

export default function ServiceResourcesFormFragment({
  title,
  description,
  serviceKey,
  disableReplicas = false,
}: ServiceResourcesFormFragmentProps) {
  const {
    setValue,
    trigger: triggerValidation,
    formState,
  } = useFormContext<ResourceSettingsFormValues>();
  const formValues = useWatch<ResourceSettingsFormValues>();
  const serviceValues = formValues[serviceKey];

  // Total allocated CPU for all resources
  const totalAllocatedVCPU = Object.keys(formValues)
    .filter(
      (key) =>
        !['enabled', 'totalAvailableVCPU', 'totalAvailableMemory'].includes(
          key,
        ),
    )
    .reduce((acc, key) => acc + formValues[key].vcpu, 0);

  // Total allocated memory for all resources
  const totalAllocatedMemory = Object.keys(formValues)
    .filter(
      (key) =>
        !['enabled', 'totalAvailableVCPU', 'totalAvailableMemory'].includes(
          key,
        ),
    )
    .reduce((acc, key) => acc + formValues[key].memory, 0);

  const remainingVCPU = formValues.totalAvailableVCPU - totalAllocatedVCPU;
  const allowedVCPU = remainingVCPU + serviceValues.vcpu;

  const remainingMemory =
    formValues.totalAvailableMemory - totalAllocatedMemory;
  const allowedMemory = remainingMemory + serviceValues.memory;

  function handleReplicaChange(value: string) {
    const updatedReplicas = parseInt(value, 10);

    if (updatedReplicas < MIN_SERVICE_REPLICAS) {
      return;
    }

    setValue(`${serviceKey}.replicas`, updatedReplicas, { shouldDirty: true });
    triggerValidation(`${serviceKey}.replicas`);
  }

  function handleVCPUChange(value: string) {
    const updatedVCPU = parseFloat(value);

    if (Number.isNaN(updatedVCPU) || updatedVCPU < MIN_SERVICE_VCPU) {
      return;
    }

    setValue(`${serviceKey}.vcpu`, updatedVCPU, { shouldDirty: true });

    // trigger validation for "replicas" field
    if (!disableReplicas) {
      triggerValidation(`${serviceKey}.replicas`);
    }
  }

  function handleMemoryChange(value: string) {
    const updatedMemory = parseFloat(value);

    if (Number.isNaN(updatedMemory) || updatedMemory < MIN_SERVICE_MEMORY) {
      return;
    }

    setValue(`${serviceKey}.memory`, updatedMemory, { shouldDirty: true });

    // trigger validation for "replicas" field
    if (!disableReplicas) {
      triggerValidation(`${serviceKey}.replicas`);
    }
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
        <Box className="grid items-center justify-between grid-flow-col gap-2">
          <Text>
            Allocated vCPUs:{' '}
            <span className="font-medium">
              {prettifyVCPU(serviceValues.vcpu)}
            </span>
          </Text>

          {remainingVCPU > 0 && serviceValues.vcpu < MAX_SERVICE_VCPU && (
            <Text className="text-sm">
              <span className="font-medium">
                {prettifyVCPU(remainingVCPU)} vCPUs
              </span>{' '}
              remaining
            </Text>
          )}
        </Box>

        <Slider
          value={serviceValues.vcpu}
          onChange={(_event, value) => handleVCPUChange(value.toString())}
          max={MAX_SERVICE_VCPU}
          step={RESOURCE_VCPU_STEP}
          allowed={allowedVCPU}
          aria-label={`${title} vCPU`}
          marks
        />
      </Box>

      <Box className="grid grid-flow-row gap-2">
        <Box className="grid items-center justify-between grid-flow-col gap-2">
          <Text>
            Allocated Memory:{' '}
            <span className="font-medium">
              {prettifyMemory(serviceValues.memory)}
            </span>
          </Text>

          {remainingMemory > 0 && serviceValues.memory < MAX_SERVICE_MEMORY && (
            <Text className="text-sm">
              <span className="font-medium">
                {prettifyMemory(remainingMemory)} of Memory
              </span>{' '}
              remaining
            </Text>
          )}
        </Box>

        <Slider
          value={serviceValues.memory}
          onChange={(_event, value) => handleMemoryChange(value.toString())}
          max={MAX_SERVICE_MEMORY}
          step={RESOURCE_MEMORY_STEP}
          allowed={allowedMemory}
          aria-label={`${title} Memory`}
          marks
        />
      </Box>

      {!disableReplicas && (
        <Box className="grid grid-flow-row gap-2">
          <Box className="grid items-center justify-start grid-flow-col gap-2">
            <Text
              color={
                formState.errors?.[serviceKey]?.replicas?.message
                  ? 'error'
                  : 'primary'
              }
              aria-errormessage={`${serviceKey}-replicas-error-tooltip`}
            >
              Replicas:{' '}
              <span className="font-medium">{serviceValues.replicas}</span>
            </Text>

            {formState.errors?.[serviceKey]?.replicas?.message ? (
              <Tooltip
                title={formState.errors[serviceKey].replicas.message}
                id={`${serviceKey}-replicas-error-tooltip`}
              >
                <ExclamationIcon
                  color="error"
                  className="w-4 h-4"
                  aria-hidden="false"
                />
              </Tooltip>
            ) : null}
          </Box>

          <Slider
            value={serviceValues.replicas}
            onChange={(_event, value) => handleReplicaChange(value.toString())}
            min={0}
            max={MAX_SERVICE_REPLICAS}
            step={1}
            aria-label={`${title} Replicas`}
            marks
          />
        </Box>
      )}
    </Box>
  );
}

import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Box } from '@/components/ui/v2/Box';
import { ExclamationIcon } from '@/components/ui/v2/icons/ExclamationIcon';
import { InfoOutlinedIcon } from '@/components/ui/v2/icons/InfoOutlinedIcon';
import { Input } from '@/components/ui/v2/Input';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { prettifyMemory } from '@/features/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_REPLICAS,
  MAX_SERVICE_VCPU,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_REPLICAS,
  MIN_SERVICE_VCPU,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
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
    register,
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

  console.log(formValues);

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
        <Box className="grid grid-flow-col gap-2 justify-between items-center">
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
        <Box className="grid grid-flow-col gap-2 justify-between items-center">
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
        <Box className="flex gap-2 justify-between">
          <Box className="flex flex-row gap-8">
            <Box className="flex flex-row gap-2 items-center">
              <Box className="grid grid-flow-col gap-2 justify-start items-center">
                {formState.errors?.[serviceKey]?.replicas?.message ? (
                  <Tooltip
                    title={formState.errors[serviceKey]?.replicas?.message}
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
              <Text>Replicas</Text>
              <Input
                {...register(`${serviceKey}.replicas`)}
                type="number"
                id={`${serviceKey}.replicas`}
                placeholder="Replicas"
                className="max-w-40"
                hideEmptyHelperText
                error={!!formState.errors?.[serviceKey]?.replicas}
                helperText={formState.errors?.[serviceKey]?.replicas?.message}
                fullWidth
                autoComplete="off"
              />
            </Box>
            <Box className="flex flex-row gap-2 items-center">
              {formState.errors?.[serviceKey]?.maxReplicas?.message ? (
                <Tooltip
                  title={formState.errors[serviceKey]?.maxReplicas?.message}
                  id={`${serviceKey}-replicas-error-tooltip`}
                >
                  <ExclamationIcon
                    color="error"
                    className="w-4 h-4"
                    aria-hidden="false"
                  />
                </Tooltip>
              ) : null}
              <Text className="text-nowrap">Max Replicas</Text>
              <Input
                {...register(`${serviceKey}.maxReplicas`)}
                type="number"
                id={`${serviceKey}.maxReplicas`}
                placeholder="10"
                disabled={!formValues[serviceKey].autoscale}
                className="max-w-40"
                hideEmptyHelperText
                error={!!formState.errors?.[serviceKey]?.maxReplicas}
                helperText={formState.errors?.[serviceKey]?.maxReplicas?.message}
                fullWidth
                autoComplete="off"
              />

            </Box>
          </Box>
          <Box className="flex flex-row gap-3 items-center">
            <ControlledSwitch
              {...register(`${serviceKey}.autoscale`)}
            />
            <Text>Autoscaling</Text>
            <Tooltip
              title={`Enable autoscaler to automatically provision extra ${title} replicas when needed.`}
            >
              <InfoOutlinedIcon
                className="w-4 h-4 text-black"
              />
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>);
}

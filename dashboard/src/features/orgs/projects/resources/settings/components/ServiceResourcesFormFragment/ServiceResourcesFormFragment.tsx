import { ControlledSwitch } from '@/components/form/ControlledSwitch';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { ExclamationIcon } from '@/components/ui/v2/icons/ExclamationIcon';
import { InfoOutlinedIcon } from '@/components/ui/v2/icons/InfoOutlinedIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Slider } from '@/components/ui/v2/Slider';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { prettifyMemory } from '@/features/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_VCPU,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_VCPU,
} from '@/features/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_MEMORY_LOCKED_STEP,
  RESOURCE_MEMORY_STEP,
  RESOURCE_VCPU_STEP,
} from '@/utils/constants/common';
import debounce from 'lodash.debounce';
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

  const isRatioLocked = serviceValues.replicas > 1 || serviceValues.autoscale;
  const resourceMemoryStep = isRatioLocked
    ? RESOURCE_MEMORY_LOCKED_STEP
    : RESOURCE_MEMORY_STEP;

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

  // Debounce revalidation to prevent excessive re-renders
  const handleReplicaChange = debounce((value: string) => {
    const updatedReplicas = parseInt(value, 10);

    setValue(`${serviceKey}.replicas`, updatedReplicas, { shouldDirty: true });
    triggerValidation(`${serviceKey}.replicas`);
    triggerValidation(`${serviceKey}.memory`);
  }, 500);

  const handleMaxReplicasChange = debounce((value: string) => {
    const updatedMaxReplicas = parseInt(value, 10);

    setValue(`${serviceKey}.maxReplicas`, updatedMaxReplicas, {
      shouldDirty: true,
    });
    triggerValidation(`${serviceKey}.maxReplicas`);
    triggerValidation(`${serviceKey}.memory`);
  }, 500);

  const handleSwitchChange = () => {
    triggerValidation(`${serviceKey}.memory`);
  };

  function handleVCPUChange(value: string) {
    const updatedVCPU = parseFloat(value);

    if (Number.isNaN(updatedVCPU) || updatedVCPU < MIN_SERVICE_VCPU) {
      return;
    }

    setValue(`${serviceKey}.vcpu`, updatedVCPU, { shouldDirty: true });

    if (isRatioLocked) {
      setValue(`${serviceKey}.memory`, updatedVCPU * 2.048, {
        shouldDirty: true,
      });
    }

    // trigger validation for "replicas" field
    if (!disableReplicas) {
      triggerValidation(`${serviceKey}.memory`);
    }
  }

  function handleMemoryChange(value: string) {
    const updatedMemory = parseFloat(value);

    if (Number.isNaN(updatedMemory) || updatedMemory < MIN_SERVICE_MEMORY) {
      return;
    }

    setValue(`${serviceKey}.memory`, updatedMemory, { shouldDirty: true });

    if (isRatioLocked) {
      setValue(`${serviceKey}.vcpu`, updatedMemory / 2.048, {
        shouldDirty: true,
      });
    }

    // trigger validation for "replicas" field
    if (!disableReplicas) {
      triggerValidation(`${serviceKey}.memory`);
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
        <Box className="grid grid-flow-col items-center justify-between gap-2">
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
        <Box className="grid grid-flow-col items-center justify-between gap-2">
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
          step={resourceMemoryStep}
          allowed={allowedMemory}
          aria-label={`${title} Memory`}
          marks
        />
        {formState.errors[serviceKey]?.memory?.message ? (
          <Alert severity="error">
            {formState.errors[serviceKey]?.memory?.message}
          </Alert>
        ) : null}
      </Box>

      {!disableReplicas && (
        <Box className="flex flex-col justify-between gap-4 lg:flex-row">
          <Box className="flex flex-col gap-4 lg:flex-row lg:gap-8">
            <Box className="flex flex-row items-center gap-2">
              {formState.errors?.[serviceKey]?.replicas?.message ? (
                <Tooltip
                  title={formState.errors[serviceKey]?.replicas?.message}
                  id={`${serviceKey}-replicas-error-tooltip`}
                >
                  <ExclamationIcon
                    color="error"
                    className="h-4 w-4"
                    aria-hidden="false"
                  />
                </Tooltip>
              ) : null}
              <Text className="w-28 lg:w-auto">Replicas</Text>
              <Input
                {...register(`${serviceKey}.replicas`)}
                onChange={(event) => handleReplicaChange(event.target.value)}
                type="number"
                id={`${serviceKey}.replicas`}
                data-testid={`${serviceKey}.replicas`}
                placeholder="Replicas"
                className="max-w-28"
                hideEmptyHelperText
                error={!!formState.errors?.[serviceKey]?.replicas}
                fullWidth
                autoComplete="off"
              />
            </Box>
            <Box className="flex flex-row items-center gap-2">
              {formState.errors?.[serviceKey]?.maxReplicas?.message ? (
                <Tooltip
                  title={formState.errors[serviceKey]?.maxReplicas?.message}
                  id={`${serviceKey}-maxReplicas-error-tooltip`}
                >
                  <ExclamationIcon
                    color="error"
                    className="h-4 w-4"
                    aria-hidden="false"
                  />
                </Tooltip>
              ) : null}
              <Text className="w-28 text-nowrap lg:w-auto">Max Replicas</Text>
              <Input
                {...register(`${serviceKey}.maxReplicas`)}
                onChange={(event) =>
                  handleMaxReplicasChange(event.target.value)
                }
                type="number"
                id={`${serviceKey}.maxReplicas`}
                placeholder="10"
                disabled={!formValues[serviceKey].autoscale}
                className="max-w-28"
                hideEmptyHelperText
                error={!!formState.errors?.[serviceKey]?.maxReplicas}
                fullWidth
                autoComplete="off"
              />
            </Box>
          </Box>
          <Box className="flex flex-row items-center gap-3">
            <ControlledSwitch
              {...register(`${serviceKey}.autoscale`)}
              onChange={handleSwitchChange}
            />
            <Text>Autoscaler</Text>
            <Tooltip
              title={`Enable autoscaler to automatically provision extra ${title} replicas when needed.`}
            >
              <InfoOutlinedIcon className="h-4 w-4" />
            </Tooltip>
          </Box>
        </Box>
      )}

      {!disableReplicas && (
        <Text>
          Learn more about{' '}
          <Link
            href="https://docs.nhost.io/platform/service-replicas"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className="font-medium"
          >
            Service Replicas
            <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
          </Link>
        </Text>
      )}
    </Box>
  );
}

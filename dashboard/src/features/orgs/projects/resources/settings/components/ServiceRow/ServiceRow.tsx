import { useEffect, useRef } from 'react';
import type { FieldError, Path, PathValue } from 'react-hook-form';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Separator } from '@/components/ui/v3/separator';
import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ComputeStepper } from '@/features/orgs/projects/resources/settings/components/ComputeStepper';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  MAX_AUTOSCALER_MAX_REPLICAS,
  MAX_SERVICE_MEMORY,
  MAX_SERVICE_REPLICAS,
  MAX_SERVICE_VCPU,
  MIN_AUTOSCALER_MAX_REPLICAS,
  MIN_SERVICE_MEMORY,
  MIN_SERVICE_REPLICAS,
  MIN_SERVICE_VCPU,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_MEMORY_LOCKED_STEP,
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_MEMORY_STEP,
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_STEP,
} from '@/utils/constants/common';

type ServiceKey = 'database' | 'hasura' | 'auth' | 'storage';

type ServiceValueShape = {
  vcpu?: number;
  memory?: number;
  replicas?: number;
  autoscale?: boolean;
  maxReplicas?: number;
  lockRatio?: boolean;
};

type ServiceErrorShape = {
  vcpu?: FieldError;
  memory?: FieldError;
  replicas?: FieldError;
  maxReplicas?: FieldError;
};

const MAX_SERVICE_VCPU_LABEL = MAX_SERVICE_VCPU / RESOURCE_VCPU_MULTIPLIER;
const MAX_SERVICE_MEMORY_LABEL = Math.floor(
  MAX_SERVICE_MEMORY / RESOURCE_MEMORY_MULTIPLIER,
);

const formatVCPU = (value: number) => `${prettifyVCPU(value).toFixed(2)} vCPU`;
const formatMemory = (value: number) =>
  value % RESOURCE_MEMORY_MULTIPLIER === 0
    ? `${(value / RESOURCE_MEMORY_MULTIPLIER).toFixed(0)} GiB`
    : `${(value / RESOURCE_MEMORY_MULTIPLIER).toFixed(2)} GiB`;
const formatInteger = (value: number) => value.toString();

export interface ServiceRowProps {
  title: string;
  description: string;
  serviceKey: ServiceKey;
  disableReplicas?: boolean;
}

export default function ServiceRow({
  title,
  description,
  serviceKey,
  disableReplicas = false,
}: ServiceRowProps) {
  const { setValue, formState } = useFormContext<ResourceSettingsFormValues>();

  const serviceValues = useWatch<ResourceSettingsFormValues>({
    name: serviceKey,
  }) as ServiceValueShape | undefined;

  const cpu = serviceValues?.vcpu ?? MIN_SERVICE_VCPU;
  const memory = serviceValues?.memory ?? MIN_SERVICE_MEMORY;
  const replicas = serviceValues?.replicas ?? 1;
  const autoscale = serviceValues?.autoscale ?? false;
  const maxReplicas = serviceValues?.maxReplicas ?? 10;
  const lockRatio = serviceValues?.lockRatio ?? true;

  const forceLocked = !disableReplicas && (replicas > 1 || autoscale);
  const effectiveLock = lockRatio || forceLocked;
  const memoryStep = forceLocked
    ? RESOURCE_MEMORY_LOCKED_STEP
    : RESOURCE_MEMORY_STEP;

  const setFieldValue = <P extends Path<ResourceSettingsFormValues>>(
    path: P,
    value: PathValue<ResourceSettingsFormValues, P>,
    options: { shouldDirty?: boolean; shouldValidate?: boolean } = {
      shouldDirty: true,
      shouldValidate: true,
    },
  ) => setValue(path, value, options);

  const memoryPath = `${serviceKey}.memory` as Path<ResourceSettingsFormValues>;
  const lockRatioPath =
    `${serviceKey}.lockRatio` as Path<ResourceSettingsFormValues>;
  const autoscalePath =
    `${serviceKey}.autoscale` as Path<ResourceSettingsFormValues>;

  const hydratedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: setFieldValue and memoryPath derive from serviceKey + form context — stable for a given service.
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (!effectiveLock) {
      return;
    }
    const derivedMemory = computeMemoryFromCPU(cpu, memoryStep);
    if (derivedMemory !== memory) {
      setFieldValue(
        memoryPath,
        derivedMemory as PathValue<
          ResourceSettingsFormValues,
          typeof memoryPath
        >,
      );
    }
  }, [effectiveLock, cpu, memory, memoryStep, serviceKey]);

  const handleCPUChange = (next: number) => {
    if (effectiveLock) {
      const nextMemory = computeMemoryFromCPU(next, memoryStep);
      setFieldValue(
        memoryPath,
        nextMemory as PathValue<ResourceSettingsFormValues, typeof memoryPath>,
      );
    }
  };

  const handleReplicasChange = (next: number) => {
    const nextForceLocked = next > 1 || autoscale;
    if (nextForceLocked) {
      const nextMemory = computeMemoryFromCPU(cpu, RESOURCE_MEMORY_LOCKED_STEP);
      setFieldValue(
        memoryPath,
        nextMemory as PathValue<ResourceSettingsFormValues, typeof memoryPath>,
      );
    }
  };

  const handleAutoscaleChange = (checked: boolean) => {
    setFieldValue(
      autoscalePath,
      checked as PathValue<ResourceSettingsFormValues, typeof autoscalePath>,
    );
    if (checked) {
      const nextMemory = computeMemoryFromCPU(cpu, RESOURCE_MEMORY_LOCKED_STEP);
      setFieldValue(
        memoryPath,
        nextMemory as PathValue<ResourceSettingsFormValues, typeof memoryPath>,
      );
    }
  };

  const billableVCPU = cpu * (disableReplicas ? 1 : replicas);
  const monthlyCost =
    (billableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

  const serviceError = formState.errors[serviceKey] as
    | ServiceErrorShape
    | undefined;
  const memoryErrorMessage = serviceError?.memory?.message;
  const replicasErrorMessage = serviceError?.replicas?.message;
  const maxReplicasErrorMessage = serviceError?.maxReplicas?.message;

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-base">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">${monthlyCost.toFixed(2)}/mo</div>
          <div className="text-muted-foreground text-xs">
            {disableReplicas
              ? '1 instance'
              : `${replicas} ${replicas === 1 ? 'replica' : 'replicas'}`}
            {autoscale ? ` · up to ${maxReplicas}` : ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center">
        <label
          htmlFor={`${serviceKey}-vcpu`}
          className="font-medium text-muted-foreground text-sm sm:text-foreground"
        >
          vCPU
        </label>
        <ComputeStepper
          name={`${serviceKey}.vcpu`}
          min={MIN_SERVICE_VCPU}
          max={MAX_SERVICE_VCPU}
          step={RESOURCE_VCPU_STEP}
          format={formatVCPU}
          ariaLabel={`${title} vCPU`}
          onValueChange={handleCPUChange}
          minHint="Minimum is 0.25 vCPU"
          maxHint={`Maximum is ${MAX_SERVICE_VCPU_LABEL} vCPU per service`}
        />

        <label
          htmlFor={`${serviceKey}-memory`}
          className="font-medium text-muted-foreground text-sm sm:text-foreground"
        >
          Memory
        </label>
        <ComputeStepper
          name={`${serviceKey}.memory`}
          min={MIN_SERVICE_MEMORY}
          max={MAX_SERVICE_MEMORY}
          step={memoryStep}
          format={formatMemory}
          ariaLabel={`${title} Memory`}
          disabled={effectiveLock}
          minHint={
            effectiveLock
              ? 'Unlock the 1:2 ratio to set memory manually'
              : 'Minimum is 128 MiB'
          }
          maxHint={`Maximum is ${MAX_SERVICE_MEMORY_LABEL} GiB per service`}
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Controller
                name={lockRatioPath}
                render={({ field }) => (
                  <Switch
                    id={`${serviceKey}-lock`}
                    checked={effectiveLock}
                    disabled={forceLocked}
                    onCheckedChange={(checked: boolean) => {
                      field.onChange(checked);
                      if (checked) {
                        const next = computeMemoryFromCPU(cpu, memoryStep);
                        setFieldValue(
                          memoryPath,
                          next as PathValue<
                            ResourceSettingsFormValues,
                            typeof memoryPath
                          >,
                        );
                      }
                    }}
                    aria-label={`Lock 1:2 ratio for ${title}`}
                    className="scale-75"
                  />
                )}
              />
            </span>
          </TooltipTrigger>
          {forceLocked && (
            <TooltipContent>
              Locked: replicas &gt; 1 or autoscale requires 1:2 ratio.
            </TooltipContent>
          )}
        </Tooltip>
        <label htmlFor={`${serviceKey}-lock`} className="text-muted-foreground">
          Lock memory to CPU at 1:2 ratio
        </label>
      </div>

      {memoryErrorMessage && (
        <p className="text-destructive text-sm">{memoryErrorMessage}</p>
      )}

      {!disableReplicas && (
        <>
          <Separator />
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-center">
            <label
              htmlFor={`${serviceKey}-replicas`}
              className="font-medium text-muted-foreground text-sm sm:text-foreground"
            >
              Replicas
            </label>
            <ComputeStepper
              name={`${serviceKey}.replicas`}
              min={MIN_SERVICE_REPLICAS}
              max={MAX_SERVICE_REPLICAS}
              step={1}
              format={formatInteger}
              ariaLabel={`${title} replicas`}
              onValueChange={handleReplicasChange}
              minHint="At least 1 replica"
              maxHint={`Up to ${MAX_SERVICE_REPLICAS} replicas`}
            />

            <div className="flex items-center gap-3">
              <Controller
                name={autoscalePath}
                render={({ field }) => (
                  <Switch
                    id={`${serviceKey}-autoscale`}
                    checked={Boolean(field.value)}
                    onCheckedChange={(checked: boolean) => {
                      field.onChange(checked);
                      handleAutoscaleChange(checked);
                    }}
                    aria-label={`${title} autoscale`}
                  />
                )}
              />
              <label
                htmlFor={`${serviceKey}-autoscale`}
                className="font-medium text-sm"
              >
                Autoscaler
              </label>
            </div>

            {autoscale ? (
              <div className="flex items-center gap-3">
                <span className="font-medium text-muted-foreground text-sm sm:text-foreground">
                  Max
                </span>
                <ComputeStepper
                  name={`${serviceKey}.maxReplicas`}
                  min={Math.max(MIN_AUTOSCALER_MAX_REPLICAS, replicas)}
                  max={MAX_AUTOSCALER_MAX_REPLICAS}
                  step={1}
                  format={formatInteger}
                  ariaLabel={`${title} max replicas`}
                  minHint="Must be ≥ replicas"
                  maxHint={`Up to ${MAX_AUTOSCALER_MAX_REPLICAS}`}
                />
              </div>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
          </div>
          {(replicasErrorMessage || maxReplicasErrorMessage) && (
            <p className="text-destructive text-sm">
              {replicasErrorMessage || maxReplicasErrorMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Separator } from '@/components/ui/v3/separator';
import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import ComputeStepper from '@/features/orgs/projects/resources/settings/components/ComputeStepper';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
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
  RESOURCE_MEMORY_LOCKED_STEP,
  RESOURCE_MEMORY_STEP,
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_STEP,
} from '@/utils/constants/common';

type ServiceKey = 'database' | 'hasura' | 'auth' | 'storage';

const formatVCPU = (value: number) => `${prettifyVCPU(value).toFixed(2)} vCPU`;
const formatMemory = (value: number) =>
  value % 1024 === 0
    ? `${(value / 1024).toFixed(0)} GiB`
    : `${(value / 1024).toFixed(2)} GiB`;
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
    // biome-ignore lint/suspicious/noExplicitAny: shape varies by service
  }) as any;

  const cpu: number = serviceValues?.vcpu ?? MIN_SERVICE_VCPU;
  const memory: number = serviceValues?.memory ?? MIN_SERVICE_MEMORY;
  const replicas: number = serviceValues?.replicas ?? 1;
  const autoscale: boolean = serviceValues?.autoscale ?? false;
  const maxReplicas: number = serviceValues?.maxReplicas ?? 10;
  const lockRatio: boolean = serviceValues?.lockRatio ?? true;

  const forceLocked = !disableReplicas && (replicas > 1 || autoscale);
  const effectiveLock = lockRatio || forceLocked;
  const memoryStep = forceLocked
    ? RESOURCE_MEMORY_LOCKED_STEP
    : RESOURCE_MEMORY_STEP;

  const hydratedRef = useRef(false);
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
      setValue(`${serviceKey}.memory` as never, derivedMemory as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [effectiveLock, cpu, memory, memoryStep, serviceKey, setValue]);

  const handleCPUChange = (next: number) => {
    if (effectiveLock) {
      const nextMemory = computeMemoryFromCPU(next, memoryStep);
      setValue(`${serviceKey}.memory` as never, nextMemory as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setValue('preset' as never, 'custom' as never, { shouldDirty: true });
  };

  const handleMemoryChange = () => {
    setValue('preset' as never, 'custom' as never, { shouldDirty: true });
  };

  const handleReplicasChange = (next: number) => {
    setValue('preset' as never, 'custom' as never, { shouldDirty: true });
    const nextForceLocked = next > 1 || autoscale;
    if (nextForceLocked) {
      const nextMemory = computeMemoryFromCPU(cpu, RESOURCE_MEMORY_LOCKED_STEP);
      setValue(`${serviceKey}.memory` as never, nextMemory as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleAutoscaleChange = (checked: boolean) => {
    setValue(`${serviceKey}.autoscale` as never, checked as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('preset' as never, 'custom' as never, { shouldDirty: true });
    if (checked) {
      const nextMemory = computeMemoryFromCPU(cpu, RESOURCE_MEMORY_LOCKED_STEP);
      setValue(`${serviceKey}.memory` as never, nextMemory as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const billableVCPU = cpu * (disableReplicas ? 1 : replicas);
  const monthlyCost =
    (billableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

  const serviceError =
    formState.errors[serviceKey as keyof typeof formState.errors];
  const memoryErrorMessage =
    serviceError && 'memory' in serviceError
      ? // biome-ignore lint/suspicious/noExplicitAny: nested form error
        (serviceError as any).memory?.message
      : null;
  const replicasErrorMessage =
    serviceError && 'replicas' in serviceError
      ? // biome-ignore lint/suspicious/noExplicitAny: nested form error
        (serviceError as any).replicas?.message
      : null;
  const maxReplicasErrorMessage =
    serviceError && 'maxReplicas' in serviceError
      ? // biome-ignore lint/suspicious/noExplicitAny: nested form error
        (serviceError as any).maxReplicas?.message
      : null;

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
          maxHint="Maximum is 7 vCPU per service"
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
          onValueChange={handleMemoryChange}
          disabled={effectiveLock}
          minHint={
            effectiveLock
              ? 'Unlock the 1:2 ratio to set memory manually'
              : 'Minimum is 128 MiB'
          }
          maxHint="Maximum is 14 GiB per service"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Controller
                name={`${serviceKey}.lockRatio` as never}
                render={({ field }) => (
                  <Switch
                    id={`${serviceKey}-lock`}
                    checked={effectiveLock}
                    disabled={forceLocked}
                    onCheckedChange={(checked: boolean) => {
                      field.onChange(checked);
                      if (checked) {
                        const next = computeMemoryFromCPU(cpu, memoryStep);
                        setValue(
                          `${serviceKey}.memory` as never,
                          next as never,
                          { shouldDirty: true, shouldValidate: true },
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
                name={`${serviceKey}.autoscale` as never}
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
                  min={Math.max(2, replicas)}
                  max={MAX_SERVICE_REPLICAS}
                  step={1}
                  format={formatInteger}
                  ariaLabel={`${title} max replicas`}
                  minHint="Must be ≥ replicas"
                  maxHint={`Up to ${MAX_SERVICE_REPLICAS}`}
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

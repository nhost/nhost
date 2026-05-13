import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
import type {
  PresetGenericAllocation,
  PresetId,
} from '@/features/orgs/projects/resources/settings/utils/presets';
import {
  detectPreset,
  getPreset,
  getPresetTopologyLine,
  PRESETS,
} from '@/features/orgs/projects/resources/settings/utils/presets';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { cn } from '@/lib/utils';

export default function PresetSelector() {
  const { setValue, trigger } = useFormContext<ResourceSettingsFormValues>();
  const values =
    useWatch<ResourceSettingsFormValues>() as ResourceSettingsFormValues;
  const activePreset: PresetId = values
    ? detectPreset({
        database: {
          vcpu: values.database?.vcpu ?? 0,
          memory: values.database?.memory ?? 0,
        },
        hasura: {
          vcpu: values.hasura?.vcpu ?? 0,
          memory: values.hasura?.memory ?? 0,
          replicas: values.hasura?.replicas ?? 1,
          autoscale: values.hasura?.autoscale ?? false,
          maxReplicas: values.hasura?.maxReplicas ?? 10,
        },
        auth: {
          vcpu: values.auth?.vcpu ?? 0,
          memory: values.auth?.memory ?? 0,
          replicas: values.auth?.replicas ?? 1,
          autoscale: values.auth?.autoscale ?? false,
          maxReplicas: values.auth?.maxReplicas ?? 10,
        },
        storage: {
          vcpu: values.storage?.vcpu ?? 0,
          memory: values.storage?.memory ?? 0,
          replicas: values.storage?.replicas ?? 1,
          autoscale: values.storage?.autoscale ?? false,
          maxReplicas: values.storage?.maxReplicas ?? 10,
        },
      })
    : 'custom';

  const applyPreset = (id: Exclude<PresetId, 'custom'>) => {
    const preset = getPreset(id);
    if (!preset) {
      return;
    }
    const opts = { shouldDirty: true, shouldValidate: true } as const;

    const isLocked = (vcpu: number, memory: number) =>
      memory === computeMemoryFromCPU(vcpu);

    setValue('database.vcpu', preset.database.vcpu, opts);
    setValue('database.memory', preset.database.memory, opts);
    setValue(
      'database.lockRatio',
      isLocked(preset.database.vcpu, preset.database.memory),
      opts,
    );

    const applyGeneric = (
      key: 'hasura' | 'auth' | 'storage',
      service: PresetGenericAllocation,
    ) => {
      setValue(`${key}.vcpu`, service.vcpu, opts);
      setValue(`${key}.memory`, service.memory, opts);
      setValue(`${key}.replicas`, service.replicas ?? 1, opts);
      setValue(`${key}.autoscale`, service.autoscale ?? false, opts);
      setValue(`${key}.maxReplicas`, service.maxReplicas ?? 10, opts);
      setValue(
        `${key}.lockRatio`,
        isLocked(service.vcpu, service.memory),
        opts,
      );
    };

    applyGeneric('hasura', preset.hasura);
    applyGeneric('auth', preset.auth);
    applyGeneric('storage', preset.storage);

    setValue('preset', id, { shouldDirty: true });
    trigger();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-sm">Preset</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    'flex h-auto min-h-[5.25rem] w-full flex-col items-start justify-start gap-0.5 px-3 py-2 text-left',
                    isActive && 'border-primary',
                  )}
                  aria-pressed={isActive}
                >
                  <span className="font-medium text-sm">{preset.label}</span>
                  <span
                    className={cn(
                      'text-xs',
                      isActive ? 'text-white/90' : 'text-muted-foreground',
                    )}
                  >
                    {preset.description}
                  </span>
                  <span
                    className={cn(
                      'text-xs',
                      isActive ? 'text-white/70' : 'text-muted-foreground/80',
                    )}
                  >
                    {getPresetTopologyLine(preset)}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {preset.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <div
          role="status"
          className={cn(
            'flex min-h-[5.25rem] flex-col items-start justify-center rounded-md border px-3 py-2 text-sm',
            activePreset === 'custom'
              ? 'border-primary text-foreground'
              : 'border-dashed text-muted-foreground',
          )}
          aria-label="Custom preset"
        >
          <span className="font-medium">Custom</span>
          <span className="text-muted-foreground text-xs">
            {activePreset === 'custom'
              ? 'Manually configured'
              : 'No preset matches'}
          </span>
        </div>
      </div>
    </div>
  );
}

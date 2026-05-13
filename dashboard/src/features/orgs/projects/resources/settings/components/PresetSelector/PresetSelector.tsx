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

  const [database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['database', 'hasura', 'auth', 'storage']
  >({ name: ['database', 'hasura', 'auth', 'storage'] });

  const activePreset: PresetId = detectPreset({
    database: {
      vcpu: database?.vcpu ?? 0,
      memory: database?.memory ?? 0,
    },
    hasura: {
      vcpu: hasura?.vcpu ?? 0,
      memory: hasura?.memory ?? 0,
      replicas: hasura?.replicas ?? 1,
      autoscale: hasura?.autoscale ?? false,
      maxReplicas: hasura?.maxReplicas ?? 10,
    },
    auth: {
      vcpu: auth?.vcpu ?? 0,
      memory: auth?.memory ?? 0,
      replicas: auth?.replicas ?? 1,
      autoscale: auth?.autoscale ?? false,
      maxReplicas: auth?.maxReplicas ?? 10,
    },
    storage: {
      vcpu: storage?.vcpu ?? 0,
      memory: storage?.memory ?? 0,
      replicas: storage?.replicas ?? 1,
      autoscale: storage?.autoscale ?? false,
      maxReplicas: storage?.maxReplicas ?? 10,
    },
  });

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

    setValue('preset', id);
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

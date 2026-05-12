import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
import type { PresetId } from '@/features/orgs/projects/resources/settings/utils/presets';
import {
  detectPreset,
  getPreset,
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
        },
        auth: {
          vcpu: values.auth?.vcpu ?? 0,
          memory: values.auth?.memory ?? 0,
          replicas: values.auth?.replicas ?? 1,
          autoscale: values.auth?.autoscale ?? false,
        },
        storage: {
          vcpu: values.storage?.vcpu ?? 0,
          memory: values.storage?.memory ?? 0,
          replicas: values.storage?.replicas ?? 1,
          autoscale: values.storage?.autoscale ?? false,
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

    for (const key of ['hasura', 'auth', 'storage'] as const) {
      setValue(`${key}.vcpu`, preset[key].vcpu, opts);
      setValue(`${key}.memory`, preset[key].memory, opts);
      setValue(`${key}.replicas`, 1, opts);
      setValue(`${key}.autoscale`, false, opts);
      setValue(`${key}.maxReplicas`, 10, opts);
      setValue(
        `${key}.lockRatio`,
        isLocked(preset[key].vcpu, preset[key].memory),
        opts,
      );
    }

    setValue('preset', id, { shouldDirty: true });
    trigger();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium text-sm">Preset</span>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <Button
              key={preset.id}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'flex h-auto flex-col items-start gap-0.5 px-3 py-2 text-left',
                isActive && 'border-primary',
              )}
              aria-pressed={isActive}
            >
              <span className="font-medium text-sm">{preset.label}</span>
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'text-white/80' : 'text-muted-foreground',
                )}
              >
                {preset.description}
              </span>
            </Button>
          );
        })}
        <div
          role="status"
          className={cn(
            'flex items-center rounded-md border px-3 py-2 text-sm',
            activePreset === 'custom'
              ? 'border-primary text-foreground'
              : 'border-dashed text-muted-foreground',
          )}
          aria-label="Custom preset"
        >
          Custom
        </div>
      </div>
    </div>
  );
}

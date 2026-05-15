import { useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import computeMemoryFromCPU from '@/features/orgs/projects/resources/settings/utils/computeMemoryFromCPU';
import {
  getPreset,
  type PresetGenericAllocation,
  type PresetId,
} from '@/features/orgs/projects/resources/settings/utils/presets/presets';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';

export function useApplyPreset() {
  const { setValue, trigger } = useFormContext<ResourceSettingsFormValues>();

  return useCallback(
    (id: Exclude<PresetId, 'custom'>) => {
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
    },
    [setValue, trigger],
  );
}

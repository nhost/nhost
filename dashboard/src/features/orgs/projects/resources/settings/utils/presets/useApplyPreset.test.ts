import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import {
  resourceSettingsValidationSchema,
  type ResourceSettingsFormValues,
} from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { act, renderHook, waitFor } from '@/tests/testUtils';
import {
  getPreset,
  type PresetGenericAllocation,
  type PresetId,
} from './presets';
import { applyPresetToForm } from './useApplyPreset';

function hydrateService(service: PresetGenericAllocation) {
  return {
    vcpu: service.vcpu,
    memory: service.memory,
    replicas: service.replicas ?? 1,
    autoscale: service.autoscale ?? false,
    maxReplicas: service.maxReplicas ?? 10,
    lockRatio: false,
  };
}

function buildDefaultValues(
  id: Exclude<PresetId, 'custom'>,
): ResourceSettingsFormValues {
  const preset = getPreset(id)!;
  return {
    enabled: true,
    database: {
      vcpu: preset.database.vcpu,
      memory: preset.database.memory,
      lockRatio: false,
    },
    hasura: hydrateService(preset.hasura),
    auth: hydrateService(preset.auth),
    storage: hydrateService(preset.storage),
  } as ResourceSettingsFormValues;
}

describe('applyPresetToForm', () => {
  // Regression test for #4562: a stale "1:2 ratio" error appeared after switching presets
  // because each field was validated on write — `memory` was checked while `autoscale`
  // still held the previous preset's value. The fix validates once, after all fields are set.
  it('validates once after the whole preset is applied, not on each intermediate field write', async () => {
    let validationRuns = 0;
    const baseResolver = yupResolver(resourceSettingsValidationSchema);
    const resolver: typeof baseResolver = (values, context, options) => {
      validationRuns += 1;
      return baseResolver(values, context, options);
    };

    // Start from an autoscaling preset so that, mid-apply, `autoscale` is still `true`
    // when the next preset's `memory` is written — the exact trigger for #4562.
    const { result } = renderHook(() =>
      useForm<ResourceSettingsFormValues>({
        resolver,
        defaultValues: buildDefaultValues('performance'),
      }),
    );

    await act(async () => {
      applyPresetToForm(
        result.current.setValue,
        result.current.trigger,
        'standard',
      );
    });

    // One validation pass over the final, consistent state — not one per field write.
    expect(validationRuns).toBe(1);

    // Standard runs a single replica with the autoscaler off, so the ratio rule is N/A.
    await waitFor(() => {
      expect(result.current.formState.errors.auth?.memory).toBeUndefined();
      expect(result.current.formState.errors.storage?.memory).toBeUndefined();
    });
  });
});

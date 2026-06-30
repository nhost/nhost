import { yupResolver } from '@hookform/resolvers/yup';
import { type UseFormSetValue, useForm } from 'react-hook-form';
import {
  type ResourceSettingsFormValues,
  resourceSettingsValidationSchema,
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
  it('applies every field without per-write validation and validates once at the end', async () => {
    let validationRuns = 0;
    const baseResolver = yupResolver(resourceSettingsValidationSchema);
    const resolver: typeof baseResolver = (values, context, options) => {
      validationRuns += 1;
      return baseResolver(values, context, options);
    };

    const { result } = renderHook(() =>
      useForm<ResourceSettingsFormValues>({
        resolver,
        defaultValues: buildDefaultValues('performance'),
      }),
    );

    const setValueOptions: Array<{ shouldValidate?: boolean }> = [];
    const trackingSetValue: UseFormSetValue<ResourceSettingsFormValues> = (
      name,
      value,
      options,
    ) => {
      setValueOptions.push({ shouldValidate: options?.shouldValidate });
      return result.current.setValue(name, value, options);
    };

    await act(async () => {
      applyPresetToForm(trackingSetValue, result.current.trigger, 'standard');
    });

    expect(setValueOptions.length).toBeGreaterThan(0);
    expect(
      setValueOptions.every(({ shouldValidate }) => shouldValidate !== true),
    ).toBe(true);

    expect(validationRuns).toBe(1);

    await waitFor(() => {
      expect(result.current.formState.errors.auth?.memory).toBeUndefined();
      expect(result.current.formState.errors.storage?.memory).toBeUndefined();
    });
  });
});

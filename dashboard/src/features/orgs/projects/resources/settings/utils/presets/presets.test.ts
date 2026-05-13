import { detectPreset, getPreset, PRESETS } from './presets';

function buildValuesFromPreset(preset: (typeof PRESETS)[number]) {
  const hydrate = (
    service: (typeof PRESETS)[number]['hasura'],
  ): {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
    maxReplicas: number;
  } => ({
    vcpu: service.vcpu,
    memory: service.memory,
    replicas: service.replicas ?? 1,
    autoscale: service.autoscale ?? false,
    maxReplicas: service.maxReplicas ?? 10,
  });

  return {
    database: { ...preset.database },
    hasura: hydrate(preset.hasura),
    auth: hydrate(preset.auth),
    storage: hydrate(preset.storage),
  };
}

test('detects each preset when values exactly match', () => {
  for (const preset of PRESETS) {
    expect(detectPreset(buildValuesFromPreset(preset))).toBe(preset.id);
  }
});

test('returns "custom" when one service is off-preset', () => {
  const standard = PRESETS.find((p) => p.id === 'standard')!;
  const values = buildValuesFromPreset(standard);
  values.auth.memory += 128;
  expect(detectPreset(values)).toBe('custom');
});

test('returns "custom" when replicas or autoscale drift from the preset', () => {
  const standard = PRESETS.find((p) => p.id === 'standard')!;
  const replicaDrift = buildValuesFromPreset(standard);
  replicaDrift.hasura.replicas = 2;
  expect(detectPreset(replicaDrift)).toBe('custom');

  const autoscaleDrift = buildValuesFromPreset(standard);
  autoscaleDrift.hasura.autoscale = true;
  expect(detectPreset(autoscaleDrift)).toBe('custom');
});

test('matches the performance-reliability preset with replicas and autoscaler', () => {
  const preset = PRESETS.find((p) => p.id === 'performance-reliability')!;
  expect(preset.hasura.replicas).toBe(2);
  expect(preset.hasura.autoscale).toBe(true);
  expect(preset.hasura.maxReplicas).toBe(10);
  expect(detectPreset(buildValuesFromPreset(preset))).toBe(
    'performance-reliability',
  );
});

test('getPreset returns the definition for non-custom ids', () => {
  expect(getPreset('starter')?.id).toBe('starter');
  expect(getPreset('custom')).toBeNull();
});

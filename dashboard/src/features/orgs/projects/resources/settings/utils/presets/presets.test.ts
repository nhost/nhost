import { detectPreset, getPreset, PRESETS } from './presets';

function buildValuesFromPreset(
  preset: (typeof PRESETS)[number],
  overrides: Partial<{ replicas: number; autoscale: boolean }> = {},
) {
  return {
    database: { ...preset.database },
    hasura: {
      ...preset.hasura,
      replicas: overrides.replicas ?? 1,
      autoscale: overrides.autoscale ?? false,
    },
    auth: {
      ...preset.auth,
      replicas: 1,
      autoscale: false,
    },
    storage: {
      ...preset.storage,
      replicas: 1,
      autoscale: false,
    },
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

test('returns "custom" when replicas or autoscale are set', () => {
  const standard = PRESETS.find((p) => p.id === 'standard')!;
  expect(detectPreset(buildValuesFromPreset(standard, { replicas: 2 }))).toBe(
    'custom',
  );
  expect(
    detectPreset(buildValuesFromPreset(standard, { autoscale: true })),
  ).toBe('custom');
});

test('getPreset returns the definition for non-custom ids', () => {
  expect(getPreset('starter')?.id).toBe('starter');
  expect(getPreset('custom')).toBeNull();
});

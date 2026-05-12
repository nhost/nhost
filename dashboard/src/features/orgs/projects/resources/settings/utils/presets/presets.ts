import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export type PresetId = 'starter' | 'standard' | 'performance' | 'custom';

export interface PresetServiceAllocation {
  vcpu: number;
  memory: number;
}

export interface PresetDefinition {
  id: Exclude<PresetId, 'custom'>;
  label: string;
  description: string;
  database: PresetServiceAllocation;
  hasura: PresetServiceAllocation;
  auth: PresetServiceAllocation;
  storage: PresetServiceAllocation;
}

const cpu = (vcpu: number) => vcpu * RESOURCE_VCPU_MULTIPLIER;
const mem = (gib: number) => gib * RESOURCE_MEMORY_MULTIPLIER;

export const PRESETS: PresetDefinition[] = [
  {
    id: 'starter',
    label: 'Starter',
    description: '1 vCPU · 2 GiB',
    database: { vcpu: cpu(0.25), memory: mem(0.5) },
    hasura: { vcpu: cpu(0.25), memory: mem(1) },
    auth: { vcpu: cpu(0.25), memory: mem(0.25) },
    storage: { vcpu: cpu(0.25), memory: mem(0.25) },
  },
  {
    id: 'standard',
    label: 'Standard',
    description: '2 vCPU · 4 GiB',
    database: { vcpu: cpu(1), memory: mem(2.5) },
    hasura: { vcpu: cpu(0.5), memory: mem(1) },
    auth: { vcpu: cpu(0.25), memory: mem(0.25) },
    storage: { vcpu: cpu(0.25), memory: mem(0.25) },
  },
  {
    id: 'performance',
    label: 'Performance',
    description: '4 vCPU · 8 GiB',
    database: { vcpu: cpu(3), memory: mem(6) },
    hasura: { vcpu: cpu(0.5), memory: mem(1.25) },
    auth: { vcpu: cpu(0.25), memory: mem(0.25) },
    storage: { vcpu: cpu(0.25), memory: mem(0.5) },
  },
];

interface PresetMatchInput {
  database: { vcpu: number; memory: number };
  hasura: {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
  };
  auth: { vcpu: number; memory: number; replicas: number; autoscale: boolean };
  storage: {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
  };
}

export function detectPreset(values: PresetMatchInput): PresetId {
  const noReplicas =
    values.hasura.replicas === 1 &&
    values.auth.replicas === 1 &&
    values.storage.replicas === 1 &&
    !values.hasura.autoscale &&
    !values.auth.autoscale &&
    !values.storage.autoscale;

  if (!noReplicas) {
    return 'custom';
  }

  const match = PRESETS.find(
    (preset) =>
      preset.database.vcpu === values.database.vcpu &&
      preset.database.memory === values.database.memory &&
      preset.hasura.vcpu === values.hasura.vcpu &&
      preset.hasura.memory === values.hasura.memory &&
      preset.auth.vcpu === values.auth.vcpu &&
      preset.auth.memory === values.auth.memory &&
      preset.storage.vcpu === values.storage.vcpu &&
      preset.storage.memory === values.storage.memory,
  );

  return match?.id ?? 'custom';
}

export function getPreset(id: PresetId): PresetDefinition | null {
  if (id === 'custom') {
    return null;
  }
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

export function isAtNaturalRatio(preset: PresetDefinition): boolean {
  return (['database', 'hasura', 'auth', 'storage'] as const).every(
    (key) => preset[key].memory === preset[key].vcpu * 2.048,
  );
}

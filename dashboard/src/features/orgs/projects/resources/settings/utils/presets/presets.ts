import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export type PresetId =
  | 'starter'
  | 'standard'
  | 'performance'
  | 'performance-reliability'
  | 'custom';

export interface PresetDatabaseAllocation {
  vcpu: number;
  memory: number;
}

export interface PresetGenericAllocation {
  vcpu: number;
  memory: number;
  replicas?: number;
  autoscale?: boolean;
  maxReplicas?: number;
}

export interface PresetDefinition {
  id: Exclude<PresetId, 'custom'>;
  label: string;
  description: string;
  tooltip: string;
  database: PresetDatabaseAllocation;
  hasura: PresetGenericAllocation;
  auth: PresetGenericAllocation;
  storage: PresetGenericAllocation;
}

const cpu = (vcpu: number) => vcpu * RESOURCE_VCPU_MULTIPLIER;
const mem = (gib: number) => gib * RESOURCE_MEMORY_MULTIPLIER;

export const PRESETS: PresetDefinition[] = [
  {
    id: 'starter',
    label: 'Starter',
    description: '1 vCPU · 2 GiB',
    tooltip:
      'Use this for small projects with low usage that still need predictable performance.',
    database: { vcpu: cpu(0.25), memory: mem(0.5) },
    hasura: { vcpu: cpu(0.25), memory: mem(1) },
    auth: { vcpu: cpu(0.25), memory: mem(0.25) },
    storage: { vcpu: cpu(0.25), memory: mem(0.25) },
  },
  {
    id: 'standard',
    label: 'Standard',
    description: '2 vCPU · 4 GiB',
    tooltip:
      'Use this for production apps with steady, moderate traffic and predictable load.',
    database: { vcpu: cpu(1), memory: mem(2.5) },
    hasura: { vcpu: cpu(0.5), memory: mem(1) },
    auth: { vcpu: cpu(0.25), memory: mem(0.25) },
    storage: { vcpu: cpu(0.25), memory: mem(0.25) },
  },
  {
    id: 'performance',
    label: 'Performance',
    description: '4 vCPU · 8 GiB',
    tooltip:
      'Use this for high-traffic apps that can burst. The autoscaler adds Hasura, Auth, and Storage replicas (up to 10) during spikes.',
    database: { vcpu: cpu(3), memory: mem(6) },
    hasura: {
      vcpu: cpu(0.5),
      memory: mem(1),
      autoscale: true,
      maxReplicas: 10,
    },
    auth: {
      vcpu: cpu(0.25),
      memory: mem(0.5),
      autoscale: true,
      maxReplicas: 10,
    },
    storage: {
      vcpu: cpu(0.25),
      memory: mem(0.5),
      autoscale: true,
      maxReplicas: 10,
    },
  },
  {
    id: 'performance-reliability',
    label: 'Performance + HA',
    description: '4 vCPU · 8 GiB',
    tooltip:
      'Use this for production-critical apps. Two replicas of Hasura, Auth, and Storage stay up to keep the app available through unforeseen issues (high availability), and the autoscaler (max 10) handles bursts.',
    database: { vcpu: cpu(3), memory: mem(6) },
    hasura: {
      vcpu: cpu(0.5),
      memory: mem(1),
      replicas: 2,
      autoscale: true,
      maxReplicas: 10,
    },
    auth: {
      vcpu: cpu(0.25),
      memory: mem(0.5),
      replicas: 2,
      autoscale: true,
      maxReplicas: 10,
    },
    storage: {
      vcpu: cpu(0.25),
      memory: mem(0.5),
      replicas: 2,
      autoscale: true,
      maxReplicas: 10,
    },
  },
];

interface PresetMatchInput {
  database: { vcpu: number; memory: number };
  hasura: {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
    maxReplicas: number;
  };
  auth: {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
    maxReplicas: number;
  };
  storage: {
    vcpu: number;
    memory: number;
    replicas: number;
    autoscale: boolean;
    maxReplicas: number;
  };
}

const genericMatches = (
  preset: PresetGenericAllocation,
  value: PresetMatchInput['hasura'],
) =>
  preset.vcpu === value.vcpu &&
  preset.memory === value.memory &&
  (preset.replicas ?? 1) === value.replicas &&
  (preset.autoscale ?? false) === value.autoscale &&
  (!preset.autoscale || (preset.maxReplicas ?? 10) === value.maxReplicas);

export function detectPreset(values: PresetMatchInput): PresetId {
  const match = PRESETS.find(
    (preset) =>
      preset.database.vcpu === values.database.vcpu &&
      preset.database.memory === values.database.memory &&
      genericMatches(preset.hasura, values.hasura) &&
      genericMatches(preset.auth, values.auth) &&
      genericMatches(preset.storage, values.storage),
  );

  return match?.id ?? 'custom';
}

export function getPreset(id: PresetId): PresetDefinition | null {
  if (id === 'custom') {
    return null;
  }
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

export function getPresetTopologyLine(preset: PresetDefinition): string {
  return getServiceTopologyLine(preset.hasura);
}

export function getServiceTopologyLine(service: {
  replicas?: number;
  autoscale?: boolean;
  maxReplicas?: number;
}): string {
  const replicas = service.replicas ?? 1;
  const autoscale = service.autoscale ?? false;
  const maxReplicas = service.maxReplicas ?? 10;
  if (replicas > 1 && autoscale) {
    return `${replicas}× replicas · autoscale ${maxReplicas}`;
  }
  if (replicas > 1) {
    return `${replicas}× replicas`;
  }
  if (autoscale) {
    return `autoscale up to ${maxReplicas}`;
  }
  return 'single replica';
}

import { subMinutes } from 'date-fns';

export const METRICS_RANGE_PRESETS = [
  '5m',
  '15m',
  '30m',
  '1h',
  '3h',
  '6h',
  '12h',
  '24h',
  '7d',
] as const;

export type MetricsRangePreset = (typeof METRICS_RANGE_PRESETS)[number];

const PRESET_MINUTES: Record<MetricsRangePreset, number> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '3h': 180,
  '6h': 360,
  '12h': 720,
  '24h': 1440,
  '7d': 10_080,
};

export const PRESET_LABELS: Record<MetricsRangePreset, string> = {
  '5m': 'Last 5 minutes',
  '15m': 'Last 15 minutes',
  '30m': 'Last 30 minutes',
  '1h': 'Last 1 hour',
  '3h': 'Last 3 hours',
  '6h': 'Last 6 hours',
  '12h': 'Last 12 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
};

export type MetricsTimeRange =
  | { kind: 'preset'; preset: MetricsRangePreset }
  | { kind: 'absolute'; from: string; to: string };

export const DEFAULT_METRICS_TIME_RANGE: MetricsTimeRange = {
  kind: 'preset',
  preset: '6h',
};

export function isMetricsRangePreset(
  value: unknown,
): value is MetricsRangePreset {
  return (
    typeof value === 'string' &&
    (METRICS_RANGE_PRESETS as readonly string[]).includes(value)
  );
}

interface ResolvedTimeRange {
  from: Date;
  to: Date;
}

export function resolveTimeRange(
  range: MetricsTimeRange,
  now: Date = new Date(),
): ResolvedTimeRange {
  if (range.kind === 'preset') {
    return {
      from: subMinutes(now, PRESET_MINUTES[range.preset]),
      to: now,
    };
  }
  return {
    from: new Date(range.from),
    to: new Date(range.to),
  };
}

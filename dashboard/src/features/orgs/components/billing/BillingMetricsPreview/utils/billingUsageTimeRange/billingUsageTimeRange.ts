const DAY_MS = 24 * 60 * 60 * 1000;

export const BILLING_USAGE_RANGE_PRESETS = [
  'currentBillingCycle',
  '7d',
  '30d',
  '60d',
] as const;

export type BillingUsageRangePreset =
  (typeof BILLING_USAGE_RANGE_PRESETS)[number];

export type BillingUsageTimeRange =
  | { kind: 'preset'; preset: BillingUsageRangePreset }
  | { kind: 'absolute'; from: string; to: string };

export interface BillingUsageRangeBounds {
  min: string;
  max: string;
  currentBillingCycleStart: string;
}

export interface ResolvedBillingUsageTimeRange {
  from: Date;
  to: Date;
}

export const DEFAULT_BILLING_USAGE_TIME_RANGE: BillingUsageTimeRange = {
  kind: 'preset',
  preset: 'currentBillingCycle',
};

export const BILLING_USAGE_PRESET_LABELS: Record<
  BillingUsageRangePreset,
  string
> = {
  currentBillingCycle: 'Current billing cycle',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '60d': 'Last 60 days',
};

const PRESET_DAYS: Partial<Record<BillingUsageRangePreset, number>> = {
  '7d': 7,
  '30d': 30,
  '60d': 60,
};

export function resolveBillingUsageTimeRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
): ResolvedBillingUsageTimeRange {
  const min = new Date(bounds.min);
  const max = new Date(bounds.max);

  if (range.kind === 'absolute') {
    return { from: new Date(range.from), to: new Date(range.to) };
  }

  if (range.preset === 'currentBillingCycle') {
    const cycleStart = new Date(bounds.currentBillingCycleStart);
    return {
      from: new Date(Math.max(min.getTime(), cycleStart.getTime())),
      to: max,
    };
  }

  const days = PRESET_DAYS[range.preset] ?? 60;
  const firstDay = startOfUtcDay(max.getTime()) - (days - 1) * DAY_MS;
  return {
    from: new Date(Math.max(min.getTime(), firstDay)),
    to: max,
  };
}

export function validateBillingUsageTimeRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
): string | undefined {
  const { from, to } = resolveBillingUsageTimeRange(range, bounds);
  const min = new Date(bounds.min);
  const max = new Date(bounds.max);
  const fromTime = from.getTime();
  const toTime = to.getTime();

  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return 'Enter a valid time range.';
  }
  if (fromTime >= toTime) {
    return '“From” must be earlier than “To”.';
  }
  if (fromTime < min.getTime()) {
    return 'Usage reports are retained for at most 60 days.';
  }
  if (toTime > max.getTime()) {
    return 'The selected range cannot extend into the future.';
  }
  if (toTime - fromTime > 60 * DAY_MS) {
    return 'The selected range cannot exceed 60 days.';
  }
  return undefined;
}

export function isBillingUsageCalendarDayDisabled(
  date: Date,
  bounds: BillingUsageRangeBounds,
): boolean {
  const day = startOfUtcDay(date.getTime());
  const minDay = startOfUtcDay(new Date(bounds.min).getTime());
  const maxDay = startOfUtcDay(new Date(bounds.max).getTime());
  return day < minDay || day > maxDay;
}

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

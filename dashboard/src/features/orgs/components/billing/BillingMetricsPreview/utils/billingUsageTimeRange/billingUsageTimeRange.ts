const DAY_MS = 24 * 60 * 60 * 1000;
const INVOICE_MARKER_PADDING_DAYS = 2;
const MIN_END_TICK_GAP_DAYS = 3;

export const BILLING_USAGE_RANGE_PRESETS = [
  'currentBillingCycle',
  'previousBillingCycle',
  '7d',
  '30d',
  '60d',
] as const;

export type BillingUsageRangePreset =
  (typeof BILLING_USAGE_RANGE_PRESETS)[number];

export function isBillingUsageRangePreset(
  value: unknown,
): value is BillingUsageRangePreset {
  return (
    typeof value === 'string' &&
    (BILLING_USAGE_RANGE_PRESETS as readonly string[]).includes(value)
  );
}

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

export interface BillingUsageTimeAxis {
  domain: [number, number];
  ticks: number[];
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
  previousBillingCycle: 'Previous billing cycle',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '60d': 'Last 60 days',
};

const PRESET_DAYS: Partial<Record<BillingUsageRangePreset, number>> = {
  '7d': 7,
  '30d': 30,
  '60d': 60,
};

const CYCLE_MONTH_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
});

// Names the UTC calendar month a billing-cycle preset covers, e.g. "Sep 2026".
export function getBillingUsagePresetCycleMonth(
  preset: BillingUsageRangePreset,
  bounds: BillingUsageRangeBounds,
): string | undefined {
  switch (preset) {
    case 'currentBillingCycle':
      return CYCLE_MONTH_FORMAT.format(
        new Date(bounds.currentBillingCycleStart),
      );
    case 'previousBillingCycle':
      return CYCLE_MONTH_FORMAT.format(
        new Date(previousBillingCycleStart(bounds.currentBillingCycleStart)),
      );
    default:
      return undefined;
  }
}

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

  // The previous cycle is clipped to the retained reports: after two 31-day
  // months its first day or two fall outside the 60-day window.
  if (range.preset === 'previousBillingCycle') {
    const cycleEnd = new Date(bounds.currentBillingCycleStart).getTime();
    return {
      from: new Date(
        Math.max(
          min.getTime(),
          previousBillingCycleStart(bounds.currentBillingCycleStart),
        ),
      ),
      to: new Date(Math.min(max.getTime(), cycleEnd - 1)),
    };
  }

  const days = PRESET_DAYS[range.preset] ?? 60;
  const firstDay = startOfUtcDay(max.getTime()) - (days - 1) * DAY_MS;
  return {
    from: new Date(Math.max(min.getTime(), firstDay)),
    to: max,
  };
}

// Bars are centred on their UTC day, so the domain extends half a day past
// the first and last ticks; otherwise the outermost bars are half clipped
// behind the axes.
export function toBillingUsageTimeAxis(
  range: BillingUsageTimeRange,
  resolved: ResolvedBillingUsageTimeRange,
  currentBillingCycleEnd: string,
): BillingUsageTimeAxis {
  const firstDay = startOfUtcDay(resolved.from.getTime());
  const lastTick =
    range.kind === 'preset' && range.preset === 'currentBillingCycle'
      ? new Date(currentBillingCycleEnd).getTime() +
        INVOICE_MARKER_PADDING_DAYS * DAY_MS
      : startOfUtcDay(resolved.to.getTime());

  return {
    domain: [firstDay - DAY_MS / 2, lastTick + DAY_MS / 2],
    ticks: createWeeklyTicks(firstDay, lastTick),
  };
}

export function toBillingUsageZoomRange(
  firstDay: number,
  lastDay: number,
  bounds: BillingUsageRangeBounds,
): BillingUsageTimeRange {
  const from = Math.max(
    startOfUtcDay(firstDay),
    new Date(bounds.min).getTime(),
  );
  const to = Math.min(
    startOfUtcDay(lastDay) + DAY_MS - 1,
    new Date(bounds.max).getTime(),
  );
  return {
    kind: 'absolute',
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
  };
}

// Doubles the visible span around its midpoint, like the functions metrics,
// but shifted to stay within the retained reports instead of running past them.
export function toBillingUsageZoomOutRange(
  range: BillingUsageTimeRange,
  bounds: BillingUsageRangeBounds,
): BillingUsageTimeRange {
  const { from, to } = resolveBillingUsageTimeRange(range, bounds);
  const min = new Date(bounds.min).getTime();
  const max = new Date(bounds.max).getTime();
  const span = Math.min((to.getTime() - from.getTime()) * 2, max - min);
  const midpoint = (from.getTime() + to.getTime()) / 2;
  const start = Math.min(Math.max(midpoint - span / 2, min), max - span);
  return toBillingUsageZoomRange(start, start + span, bounds);
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

function createWeeklyTicks(firstTick: number, lastTick: number): number[] {
  const ticks: number[] = [];
  for (
    let timestamp = firstTick;
    timestamp < lastTick;
    timestamp += 7 * DAY_MS
  ) {
    ticks.push(timestamp);
  }
  const lastWeeklyTick = ticks[ticks.length - 1];
  if (
    ticks.length > 1 &&
    lastTick - lastWeeklyTick < MIN_END_TICK_GAP_DAYS * DAY_MS
  ) {
    ticks.pop();
  }
  ticks.push(lastTick);
  return ticks;
}

function previousBillingCycleStart(currentBillingCycleStart: string): number {
  const cycleStart = new Date(currentBillingCycleStart);
  return Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() - 1, 1);
}

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

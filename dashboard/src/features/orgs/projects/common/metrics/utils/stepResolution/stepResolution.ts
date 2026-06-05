const SEC = 1_000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;

// [ltMs, bucketMs]: first row where intervalMs < ltMs wins; fallback is YEAR.
// Below 1d the thresholds are arithmetic midpoints between adjacent buckets;
// from 1d up they're hand-tuned to bias toward the coarser bucket.
const NICE_BUCKETS: ReadonlyArray<readonly [ltMs: number, bucketMs: number]> = [
  // sub-second
  [10, 1],
  [15, 10],
  [35, 20],
  [75, 50],
  [150, 100],
  [350, 200],
  [750, 500],
  // sub-minute
  [1_500, SEC],
  [3_500, 2 * SEC],
  [7_500, 5 * SEC],
  [12_500, 10 * SEC],
  [17_500, 15 * SEC],
  [25_000, 20 * SEC],
  [45_000, 30 * SEC],
  // sub-hour
  [90 * SEC, MIN],
  [3.5 * MIN, 2 * MIN],
  [7.5 * MIN, 5 * MIN],
  [12.5 * MIN, 10 * MIN],
  [17.5 * MIN, 15 * MIN],
  [25 * MIN, 20 * MIN],
  [45 * MIN, 30 * MIN],
  // sub-day
  [90 * MIN, HOUR],
  [2.5 * HOUR, 2 * HOUR],
  [4.5 * HOUR, 3 * HOUR],
  [9 * HOUR, 6 * HOUR],
  [DAY, 12 * HOUR],
  // long range
  [WEEK, DAY],
  [3 * WEEK, WEEK],
  [6 * WEEK, 30 * DAY],
];

// Snaps a raw step (ms) to a fixed bucket set so the same range / chart-width
// combination always produces the same `step`, smoothing over small width
// differences and keeping the resolution stable across refetches.
export function roundIntervalMs(intervalMs: number): number {
  return NICE_BUCKETS.find(([lt]) => intervalMs < lt)?.[1] ?? YEAR;
}

export const DEFAULT_MAX_DATA_POINTS = 600;

export const DEFAULT_MIN_INTERVAL = '2m';

// Used when the range is degenerate (from === to). The exact value barely
// matters since DEFAULT_MIN_INTERVAL floors the step; it just needs to be a
// positive integer.
const FALLBACK_INTERVAL_MS = 15_000;

export function resolveMaxDataPoints(chartWidth: number): number {
  if (!Number.isFinite(chartWidth) || chartWidth <= 0) {
    return DEFAULT_MAX_DATA_POINTS;
  }
  return Math.floor(chartWidth);
}

interface QueryStep {
  intervalMs: number;
  maxDataPoints: number;
}

export function computeQueryStep(
  from: Date,
  to: Date,
  maxDataPoints: number = DEFAULT_MAX_DATA_POINTS,
): QueryStep {
  const span = to.getTime() - from.getTime();
  if (span <= 0 || maxDataPoints <= 0) {
    return {
      intervalMs: FALLBACK_INTERVAL_MS,
      maxDataPoints: DEFAULT_MAX_DATA_POINTS,
    };
  }
  const rawStep = span / maxDataPoints;
  return { intervalMs: roundIntervalMs(rawStep), maxDataPoints };
}

// Mirrors Grafana's rangeutil.ts → roundInterval. Snaps a raw step (ms) to one
// of Grafana's "nice" buckets so distinct viewers of the same range preset
// produce identical (start, end, step) tuples and share Prometheus cache keys.
export function roundInterval(intervalMs: number): number {
  switch (true) {
    case intervalMs < 10:
      return 1;
    case intervalMs < 15:
      return 10;
    case intervalMs < 35:
      return 20;
    case intervalMs < 75:
      return 50;
    case intervalMs < 150:
      return 100;
    case intervalMs < 350:
      return 200;
    case intervalMs < 750:
      return 500;
    case intervalMs < 1_500:
      return 1_000;
    case intervalMs < 3_500:
      return 2_000;
    case intervalMs < 7_500:
      return 5_000;
    case intervalMs < 12_500:
      return 10_000;
    case intervalMs < 17_500:
      return 15_000;
    case intervalMs < 25_000:
      return 20_000;
    case intervalMs < 45_000:
      return 30_000;
    case intervalMs < 90_000:
      return 60_000;
    case intervalMs < 210_000:
      return 120_000;
    case intervalMs < 450_000:
      return 300_000;
    case intervalMs < 750_000:
      return 600_000;
    case intervalMs < 1_050_000:
      return 900_000;
    case intervalMs < 1_500_000:
      return 1_200_000;
    case intervalMs < 2_700_000:
      return 1_800_000;
    case intervalMs < 5_400_000:
      return 3_600_000;
    case intervalMs < 9_000_000:
      return 7_200_000;
    case intervalMs < 16_200_000:
      return 10_800_000;
    case intervalMs < 32_400_000:
      return 21_600_000;
    case intervalMs < 86_400_000:
      return 43_200_000;
    case intervalMs < 604_800_000:
      return 86_400_000;
    case intervalMs < 1_814_400_000:
      return 604_800_000;
    case intervalMs < 3_628_800_000:
      return 2_592_000_000;
    default:
      return 31_536_000_000;
  }
}

// Fallback when the panel hasn't been measured yet (first render, before the
// ResizeObserver fires). Close enough to a typical xl:grid-cols-2 chart cell
// that the post-measurement query usually deep-equals and doesn't re-fire.
export const DEFAULT_MAX_DATA_POINTS = 600;

// Prometheus duration string that floors the computed step on the server.
export const DEFAULT_MIN_INTERVAL = '2m';

// Used when the range is degenerate (from === to). The backend's minInterval
// floors the effective step server-side; we still need to send a positive Int.
const FALLBACK_INTERVAL_MS = 15_000;

const MAX_DATA_POINTS_CAP = 2000;
const MAX_DATA_POINTS_FLOOR = 200;
// Round chartWidth to this so trivial pixel shifts don't re-fire the query.
const MAX_DATA_POINTS_STEP = 50;

export function resolveMaxDataPoints(chartWidth: number): number {
  if (!Number.isFinite(chartWidth) || chartWidth <= 0) {
    return DEFAULT_MAX_DATA_POINTS;
  }
  const stepped =
    Math.round(chartWidth / MAX_DATA_POINTS_STEP) * MAX_DATA_POINTS_STEP;
  return Math.max(
    MAX_DATA_POINTS_FLOOR,
    Math.min(MAX_DATA_POINTS_CAP, stepped),
  );
}

export interface QueryStep {
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
  return { intervalMs: roundInterval(rawStep), maxDataPoints };
}

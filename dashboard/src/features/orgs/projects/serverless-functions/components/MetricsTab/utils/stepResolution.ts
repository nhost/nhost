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

// Static target points for the batched dashboard query. The 10 panels in the
// query share one step, so we can't size to any individual panel — 600 is a
// reasonable midpoint for a typical desktop layout.
export const DEFAULT_MAX_DATA_POINTS = 600;

// Floor matching our Prometheus scrape interval. Steps below this don't add
// resolution, they just multiply work.
export const MIN_STEP_MS = 15_000;

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
    return { intervalMs: MIN_STEP_MS, maxDataPoints: DEFAULT_MAX_DATA_POINTS };
  }
  const rawStep = span / maxDataPoints;
  const rounded = roundInterval(rawStep);
  const intervalMs = Math.max(rounded, MIN_STEP_MS);
  return { intervalMs, maxDataPoints };
}

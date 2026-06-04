import {
  computeQueryStep,
  DEFAULT_MAX_DATA_POINTS,
  resolveMaxDataPoints,
  roundIntervalMs,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/stepResolution';

const minutesAgo = (now: Date, minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

describe('computeQueryStep', () => {
  const now = new Date('2026-05-26T12:00:00Z');

  it('snaps short presets to the matching bucket (no client floor)', () => {
    // 15m / 600 = 1500ms raw → bucket: 2000ms.
    const { intervalMs, maxDataPoints } = computeQueryStep(
      minutesAgo(now, 15),
      now,
    );
    expect(intervalMs).toBe(2_000);
    expect(maxDataPoints).toBe(DEFAULT_MAX_DATA_POINTS);
  });

  it('snaps long presets to a nice bucket', () => {
    // 7d (10080m) / 600 = 1_008_000ms raw → bucket: 900_000ms (15min).
    const { intervalMs } = computeQueryStep(minutesAgo(now, 10_080), now);
    expect(intervalMs).toBe(900_000);
  });

  it('honors a caller-supplied maxDataPoints', () => {
    // 1h / 1200 = 3000ms raw → bucket: 2000ms.
    const { intervalMs, maxDataPoints } = computeQueryStep(
      minutesAgo(now, 60),
      now,
      1200,
    );
    expect(intervalMs).toBe(2_000);
    expect(maxDataPoints).toBe(1200);
  });

  it('returns a sane fallback when from === to', () => {
    expect(computeQueryStep(now, now)).toEqual({
      intervalMs: 15_000,
      maxDataPoints: DEFAULT_MAX_DATA_POINTS,
    });
  });
});

describe('roundIntervalMs', () => {
  it('snaps below/at the 1500ms threshold to the right bucket', () => {
    expect(roundIntervalMs(1_499)).toBe(1_000);
    expect(roundIntervalMs(1_500)).toBe(2_000);
  });
});

describe('resolveMaxDataPoints', () => {
  it('maps width to maxDataPoints one-to-one (no clamp)', () => {
    expect(resolveMaxDataPoints(617)).toBe(617);
    expect(resolveMaxDataPoints(1_234)).toBe(1_234);
    expect(resolveMaxDataPoints(50)).toBe(50);
    expect(resolveMaxDataPoints(5_000)).toBe(5_000);
  });

  it('floors fractional widths', () => {
    expect(resolveMaxDataPoints(617.9)).toBe(617);
  });

  it('falls back to the default for non-positive or non-finite inputs', () => {
    expect(resolveMaxDataPoints(0)).toBe(DEFAULT_MAX_DATA_POINTS);
    expect(resolveMaxDataPoints(-100)).toBe(DEFAULT_MAX_DATA_POINTS);
    expect(resolveMaxDataPoints(Number.NaN)).toBe(DEFAULT_MAX_DATA_POINTS);
  });
});

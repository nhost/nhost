import {
  computeQueryStep,
  DEFAULT_MAX_DATA_POINTS,
  resolveMaxDataPoints,
  roundInterval,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/stepResolution';

const minutesAgo = (now: Date, minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

describe('computeQueryStep', () => {
  const now = new Date('2026-05-26T12:00:00Z');

  it('snaps short presets to the matching Grafana bucket (no client floor)', () => {
    // 15m / 600 = 1500ms raw → bucket: 2000ms. The 15s scrape-interval floor
    // now lives on the server (minInterval), so the dashboard sends the raw
    // snapped step.
    const { intervalMs, maxDataPoints } = computeQueryStep(
      minutesAgo(now, 15),
      now,
    );
    expect(intervalMs).toBe(2_000);
    expect(maxDataPoints).toBe(DEFAULT_MAX_DATA_POINTS);
  });

  it('snaps long presets to a Grafana nice bucket', () => {
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

describe('roundInterval', () => {
  it('snaps below/at the 1500ms threshold to the right bucket', () => {
    expect(roundInterval(1_499)).toBe(1_000);
    expect(roundInterval(1_500)).toBe(2_000);
  });
});

describe('resolveMaxDataPoints', () => {
  it('rounds to the nearest 50px step', () => {
    expect(resolveMaxDataPoints(617)).toBe(600);
    expect(resolveMaxDataPoints(625)).toBe(650);
  });

  it('floors at the minimum threshold', () => {
    expect(resolveMaxDataPoints(50)).toBe(200);
  });

  it('caps at the maximum threshold', () => {
    expect(resolveMaxDataPoints(5_000)).toBe(2_000);
  });

  it('falls back to the default for non-positive or non-finite inputs', () => {
    expect(resolveMaxDataPoints(0)).toBe(DEFAULT_MAX_DATA_POINTS);
    expect(resolveMaxDataPoints(-100)).toBe(DEFAULT_MAX_DATA_POINTS);
    expect(resolveMaxDataPoints(Number.NaN)).toBe(DEFAULT_MAX_DATA_POINTS);
  });
});

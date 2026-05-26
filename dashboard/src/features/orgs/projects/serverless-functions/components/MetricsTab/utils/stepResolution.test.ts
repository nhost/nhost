import {
  computeQueryStep,
  DEFAULT_MAX_DATA_POINTS,
  MIN_STEP_MS,
  roundInterval,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/stepResolution';

const minutesAgo = (now: Date, minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);

describe('computeQueryStep', () => {
  const now = new Date('2026-05-26T12:00:00Z');

  it('clamps short presets to the 15s scrape interval floor', () => {
    // 15m span / 600 = 1500ms raw → snap 2000ms → floor 15s.
    const { intervalMs, maxDataPoints } = computeQueryStep(
      minutesAgo(now, 15),
      now,
    );
    expect(intervalMs).toBe(MIN_STEP_MS);
    expect(maxDataPoints).toBe(DEFAULT_MAX_DATA_POINTS);
  });

  it('snaps long presets to a Grafana nice bucket above the floor', () => {
    // 7d (10080m) span / 600 = 1_008_000ms raw → snap 900_000ms (15min).
    const { intervalMs } = computeQueryStep(minutesAgo(now, 10_080), now);
    expect(intervalMs).toBe(900_000);
  });

  it('falls back to defaults when from === to', () => {
    expect(computeQueryStep(now, now)).toEqual({
      intervalMs: MIN_STEP_MS,
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

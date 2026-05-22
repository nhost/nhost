import {
  buildTimeTicks,
  computeTickStep,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/buildTimeTicks';

const ts = (iso: string) => new Date(iso).getTime();

describe('buildTimeTicks', () => {
  it('returns empty array when toMs <= fromMs', () => {
    expect(buildTimeTicks([1000, 1000])).toEqual([]);
    expect(buildTimeTicks([2000, 1000])).toEqual([]);
  });

  it('returns empty array when targetCount < 2', () => {
    expect(buildTimeTicks([0, 1_000_000], 1)).toEqual([]);
    expect(buildTimeTicks([0, 1_000_000], 0)).toEqual([]);
  });

  it('builds 1-minute ticks across a 5-minute window', () => {
    const from = ts('2026-05-16T12:00:00Z');
    const to = ts('2026-05-16T12:05:00Z');
    expect(buildTimeTicks([from, to])).toEqual([
      ts('2026-05-16T12:00:00Z'),
      ts('2026-05-16T12:01:00Z'),
      ts('2026-05-16T12:02:00Z'),
      ts('2026-05-16T12:03:00Z'),
      ts('2026-05-16T12:04:00Z'),
      ts('2026-05-16T12:05:00Z'),
    ]);
  });

  it('builds 1-hour ticks across a 6-hour window', () => {
    const from = ts('2026-05-16T06:00:00Z');
    const to = ts('2026-05-16T12:00:00Z');
    const ticks = buildTimeTicks([from, to]);
    expect(ticks[0]).toBe(from);
    expect(ticks[ticks.length - 1]).toBe(to);
    expect(ticks[1] - ticks[0]).toBe(60 * 60_000);
  });

  it('snaps the first tick up to a step boundary', () => {
    const from = ts('2026-05-16T12:03:24Z');
    const to = ts('2026-05-16T12:30:00Z');
    const ticks = buildTimeTicks([from, to]);
    expect(ticks[0]).toBe(ts('2026-05-16T12:05:00Z'));
  });

  it('falls back to the largest candidate when rawStep exceeds all candidates', () => {
    const from = ts('2026-05-01T00:00:00Z');
    const to = ts('2026-05-31T00:00:00Z');
    const ticks = buildTimeTicks([from, to]);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[1] - ticks[0]).toBe(2 * 24 * 60 * 60_000);
  });

  it('builds 5-second ticks across a 30-second window', () => {
    const from = ts('2026-05-16T12:00:00Z');
    const to = ts('2026-05-16T12:00:30Z');
    const ticks = buildTimeTicks([from, to]);
    expect(ticks[0]).toBe(from);
    expect(ticks[ticks.length - 1]).toBe(to);
    expect(ticks[1] - ticks[0]).toBe(5_000);
  });
});

describe('computeTickStep', () => {
  it('returns sub-minute steps for short windows', () => {
    expect(computeTickStep([0, 30_000])).toBe(5_000);
    expect(computeTickStep([0, 60_000])).toBe(10_000);
    expect(computeTickStep([0, 180_000])).toBe(30_000);
  });

  it('returns minute-or-larger steps for longer windows', () => {
    expect(computeTickStep([0, 6 * 60_000])).toBe(60_000);
    expect(computeTickStep([0, 60 * 60_000])).toBe(10 * 60_000);
  });

  it('returns 0 for invalid ranges', () => {
    expect(computeTickStep([1000, 1000])).toBe(0);
    expect(computeTickStep([0, 60_000], 1)).toBe(0);
  });
});

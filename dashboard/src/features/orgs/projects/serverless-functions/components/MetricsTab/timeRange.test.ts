import {
  DEFAULT_METRICS_TIME_RANGE,
  isMetricsRangePreset,
  METRICS_RANGE_PRESETS,
  type MetricsRangePreset,
  resolveTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';

// Second source of truth for the preset → minutes contract: a typo in the
// production PRESET_MINUTES table (which silently shifts every query window)
// has to disagree with this map to land, so the mismatch fails the test.
const EXPECTED_MINUTES: Record<MetricsRangePreset, number> = {
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

describe('resolveTimeRange', () => {
  const now = new Date('2026-05-26T12:00:00Z');

  it('resolves every preset to [now - presetMinutes, now]', () => {
    for (const preset of METRICS_RANGE_PRESETS) {
      const { from, to } = resolveTimeRange({ kind: 'preset', preset }, now);
      expect(to.getTime()).toBe(now.getTime());
      expect(from.getTime()).toBe(
        now.getTime() - EXPECTED_MINUTES[preset] * 60_000,
      );
    }
  });

  it('passes an absolute range through as Dates', () => {
    const from = '2026-05-20T00:00:00.000Z';
    const to = '2026-05-26T00:00:00.000Z';
    const resolved = resolveTimeRange({ kind: 'absolute', from, to }, now);
    expect(resolved.from.toISOString()).toBe(from);
    expect(resolved.to.toISOString()).toBe(to);
  });
});

describe('isMetricsRangePreset', () => {
  it('accepts every supported preset', () => {
    for (const preset of METRICS_RANGE_PRESETS) {
      expect(isMetricsRangePreset(preset)).toBe(true);
    }
  });

  it('rejects unknown strings and non-strings', () => {
    expect(isMetricsRangePreset('foo')).toBe(false);
    expect(isMetricsRangePreset('5min')).toBe(false);
    expect(isMetricsRangePreset('')).toBe(false);
    expect(isMetricsRangePreset(5)).toBe(false);
    expect(isMetricsRangePreset(null)).toBe(false);
    expect(isMetricsRangePreset(undefined)).toBe(false);
    expect(isMetricsRangePreset({})).toBe(false);
  });

  it('keeps the default range a valid preset', () => {
    expect(DEFAULT_METRICS_TIME_RANGE.kind).toBe('preset');
    if (DEFAULT_METRICS_TIME_RANGE.kind === 'preset') {
      expect(isMetricsRangePreset(DEFAULT_METRICS_TIME_RANGE.preset)).toBe(
        true,
      );
    }
  });
});

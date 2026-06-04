import {
  formatBytesIEC,
  formatBytesSI,
  formatDurationSeconds,
  formatInteger,
  formatMs,
  formatPercentUnit,
  formatTimestampFull,
  formatTimestampTick,
  formatterForKind,
} from '@/features/orgs/projects/common/metrics/utils/formatters';

describe('formatterForKind', () => {
  it('maps each value-formatter kind to its formatter', () => {
    // The 'bytes' kind formats as IEC / KiB.
    expect(formatterForKind('bytes')).toBe(formatBytesIEC);
    expect(formatterForKind('ms')).toBe(formatMs);
    expect(formatterForKind('percent-unit')).toBe(formatPercentUnit);
    // 'integer' resolves through the default branch.
    expect(formatterForKind('integer')).toBe(formatInteger);
  });
});

describe('byte formatters', () => {
  it('formatBytesIEC scales by 1024 with IEC units (KiB, MiB, …)', () => {
    expect(formatBytesIEC(512)).toBe('512 B');
    expect(formatBytesIEC(1024)).toBe('1.00 KiB');
    expect(formatBytesIEC(1536)).toBe('1.50 KiB');
    expect(formatBytesIEC(1024 * 1024)).toBe('1.00 MiB');
  });

  it('formatBytesSI scales by 1000 with SI units (kB, MB, …)', () => {
    expect(formatBytesSI(512)).toBe('512 B');
    expect(formatBytesSI(1000)).toBe('1.00 kB');
    expect(formatBytesSI(1500)).toBe('1.50 kB');
    expect(formatBytesSI(1_000_000)).toBe('1.00 MB');
  });
});

describe('formatInteger', () => {
  it('rounds near-integers and adds en-US thousands separators', () => {
    expect(formatInteger(5)).toBe('5');
    expect(formatInteger(1234)).toBe('1,234');
    expect(formatInteger(1_000_000)).toBe('1,000,000');
  });

  it('keeps up to 2 fraction digits for genuinely fractional values', () => {
    expect(formatInteger(1234.5)).toBe('1,234.5');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatInteger(Number.NaN)).toBe('—');
    expect(formatInteger(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatDurationSeconds', () => {
  it('renders sub-second values in milliseconds', () => {
    expect(formatDurationSeconds(0.5)).toBe('500 ms');
  });

  it('renders seconds with adaptive precision (2dp <10s, 1dp >=10s)', () => {
    expect(formatDurationSeconds(5)).toBe('5.00s');
    expect(formatDurationSeconds(10)).toBe('10.0s');
  });

  it('renders minutes, dropping a zero seconds remainder', () => {
    expect(formatDurationSeconds(125)).toBe('2m 5s');
    expect(formatDurationSeconds(120)).toBe('2m');
  });

  it('renders hours, dropping a zero minutes remainder', () => {
    expect(formatDurationSeconds(3660)).toBe('1h 1m');
    expect(formatDurationSeconds(7200)).toBe('2h');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatDurationSeconds(Number.NaN)).toBe('—');
  });
});

describe('formatMs', () => {
  it('scales seconds to ms with shrinking precision as the value grows', () => {
    expect(formatMs(0.0005)).toBe('0.50 ms');
    expect(formatMs(0.005)).toBe('5.0 ms');
    expect(formatMs(0.05)).toBe('50 ms');
    expect(formatMs(0.1)).toBe('100 ms');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatMs(Number.NaN)).toBe('—');
  });
});

describe('formatPercentUnit', () => {
  it('renders ratios as percentages across the threshold bands', () => {
    expect(formatPercentUnit(0)).toBe('0%');
    expect(formatPercentUnit(0.00005)).toBe('<0.01%');
    expect(formatPercentUnit(0.005)).toBe('0.50%');
    expect(formatPercentUnit(0.5)).toBe('50.0%');
    expect(formatPercentUnit(1)).toBe('100.0%');
  });

  it('renders an em dash for non-finite input', () => {
    expect(formatPercentUnit(Number.NaN)).toBe('—');
  });
});

describe('timestamp formatters', () => {
  // The formatting itself is a date-fns pass-through; the guard is our logic and
  // protects the chart axis/tooltip when a sparse series yields null/NaN ticks.
  it('returns an empty string for non-numeric / non-finite input', () => {
    expect(formatTimestampTick(undefined)).toBe('');
    expect(formatTimestampTick(Number.NaN)).toBe('');
    expect(formatTimestampTick(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatTimestampTick('not-a-number')).toBe('');
    expect(formatTimestampFull('not-a-number')).toBe('');
  });

  it('formats a finite timestamp into the expected shape', () => {
    expect(formatTimestampTick(Date.UTC(2026, 4, 26, 9, 30))).toMatch(
      /^\d{2}:\d{2}$/,
    );
    expect(formatTimestampFull(Date.UTC(2026, 4, 26, 9, 30))).toMatch(/\d/);
  });
});

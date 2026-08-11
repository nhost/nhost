import { format } from 'date-fns';

export type ValueFormatterKind = 'integer' | 'bytes' | 'ms' | 'percent-unit';

export function formatInteger(v: number): string {
  if (!Number.isFinite(v)) {
    return '—';
  }
  const rounded = Math.round(v);
  if (Math.abs(v - rounded) < 1e-9) {
    return rounded.toLocaleString('en-US');
  }
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Scales a byte count into the largest unit whose magnitude is >= 1, with
// adaptive precision (0 dp >= 100, 1 dp >= 10, else 2 dp). `base` is 1024 for
// IEC units or 1000 for SI.
function formatScaledBytes(
  bytes: number,
  base: number,
  units: readonly string[],
): string {
  if (!Number.isFinite(bytes)) {
    return '—';
  }
  if (Math.abs(bytes) < base) {
    return `${Math.round(bytes)} B`;
  }
  let value = bytes / base;
  let unitIndex = 0;
  while (Math.abs(value) >= base && unitIndex < units.length - 1) {
    value /= base;
    unitIndex += 1;
  }
  const precision = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

// IEC / binary bytes (1024-based: B, KiB, MiB, …). Used for per-request sizes
// like Average Response Size.
export function formatBytesIEC(bytes: number): string {
  return formatScaledBytes(bytes, 1024, ['KiB', 'MiB', 'GiB', 'TiB', 'PiB']);
}

// SI / decimal bytes (1000-based: B, kB, MB, …). Used for aggregate totals like
// Total Bytes Sent.
export function formatBytesSI(bytes: number): string {
  return formatScaledBytes(bytes, 1000, ['kB', 'MB', 'GB', 'TB', 'PB']);
}

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '—';
  }
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)} ms`;
  }
  if (seconds < 60) {
    const precision = seconds >= 10 ? 1 : 2;
    return `${seconds.toFixed(precision)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  if (minutes < 60) {
    return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

export function formatMs(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '—';
  }
  const ms = seconds * 1000;
  if (ms < 1) {
    return `${ms.toFixed(2)} ms`;
  }
  if (ms < 10) {
    return `${ms.toFixed(1)} ms`;
  }
  return `${Math.round(ms)} ms`;
}

export function formatPercentUnit(ratio: number): string {
  if (!Number.isFinite(ratio)) {
    return '—';
  }
  const pct = ratio * 100;
  if (pct === 0) {
    return '0%';
  }
  if (Math.abs(pct) < 0.01) {
    return '<0.01%';
  }
  if (Math.abs(pct) < 1) {
    return `${pct.toFixed(2)}%`;
  }
  return `${pct.toFixed(1)}%`;
}

export function formatterForKind(
  kind: ValueFormatterKind,
): (v: number) => string {
  switch (kind) {
    case 'bytes':
      return formatBytesIEC;
    case 'ms':
      return formatMs;
    case 'percent-unit':
      return formatPercentUnit;
    default:
      return formatInteger;
  }
}

function formatTimestampWith(ts: unknown, pattern: string): string {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n)) {
    return '';
  }
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return format(d, pattern);
}

export function formatTimestampTick(ts: unknown): string {
  return formatTimestampWith(ts, 'HH:mm');
}

export function formatTimestampSecondsTick(ts: unknown): string {
  return formatTimestampWith(ts, 'HH:mm:ss');
}

export function formatTimestampDateTick(ts: unknown): string {
  return formatTimestampWith(ts, 'MM-dd HH:mm');
}

export function formatTimestampFull(ts: unknown): string {
  return formatTimestampWith(ts, 'MMM d, HH:mm:ss');
}

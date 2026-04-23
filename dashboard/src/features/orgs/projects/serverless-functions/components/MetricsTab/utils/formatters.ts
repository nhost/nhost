import { format } from 'date-fns';

export function formatInteger(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) {
    return '—';
  }
  const abs = Math.abs(bytes);
  if (abs < 1000) {
    return `${Math.round(bytes)} B`;
  }
  const units = ['kB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes / 1000;
  let unitIndex = 0;
  while (Math.abs(value) >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const precision = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
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

export function formatTimestampTick(ts: unknown): string {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n)) {
    return '';
  }
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return format(d, 'HH:mm');
}

export function formatTimestampFull(ts: unknown): string {
  const n = typeof ts === 'number' ? ts : Number(ts);
  if (!Number.isFinite(n)) {
    return '';
  }
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return format(d, 'MMM d, HH:mm:ss');
}

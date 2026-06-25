import { isSameLogEntry } from '@/features/orgs/projects/logs/components/LogsBody/isSameLogEntry';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';

const entry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  timestamp: '2026-05-01T00:00:00Z',
  service: 'hasura',
  log: 'sample log',
  ...overrides,
});

describe('isSameLogEntry', () => {
  it('returns false when either side is null', () => {
    expect(isSameLogEntry(null, entry())).toBe(false);
    expect(isSameLogEntry(entry(), null)).toBe(false);
    expect(isSameLogEntry(null, null)).toBe(false);
  });

  it('returns false when b is undefined', () => {
    expect(isSameLogEntry(entry(), undefined)).toBe(false);
  });

  it('returns true for two distinct objects with identical fields', () => {
    const a = entry();
    const b = entry();
    expect(a).not.toBe(b);
    expect(isSameLogEntry(a, b)).toBe(true);
  });

  it('returns false when any field differs', () => {
    const base = entry();
    expect(isSameLogEntry(base, entry({ timestamp: '2026-05-01T00:00:01Z' }))).toBe(
      false,
    );
    expect(isSameLogEntry(base, entry({ service: 'postgres' }))).toBe(false);
    expect(isSameLogEntry(base, entry({ log: 'different' }))).toBe(false);
  });
});

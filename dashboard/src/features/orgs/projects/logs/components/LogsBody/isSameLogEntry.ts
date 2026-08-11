import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';

export function isSameLogEntry(
  a: LogEntry | null,
  b: LogEntry | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.timestamp === b.timestamp && a.service === b.service && a.log === b.log;
}

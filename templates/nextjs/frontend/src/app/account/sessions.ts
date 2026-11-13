import type { AccountSession } from '@/app/account/actions';

/**
 * The sessions as the account page lists them: this one first, then the most
 * recently signed in.
 */
export function sortSessions(sessions: AccountSession[]): AccountSession[] {
  return [...sessions].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

const ordinals = new Intl.PluralRules('en-US', { type: 'ordinal' });
const SUFFIXES: Record<string, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
};

/**
 * "Oct 26th 2026 12:24 PM", in `timeZone`, or the runtime's own zone without
 * one.
 */
export function formatSessionTime(iso: string, timeZone?: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    })
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, value]),
  );
  const suffix = SUFFIXES[ordinals.select(Number(parts.day))] ?? 'th';

  return `${parts.month} ${parts.day}${suffix} ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

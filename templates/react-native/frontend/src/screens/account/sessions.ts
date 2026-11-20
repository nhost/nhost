import type { AccountSession } from '@/screens/account/actions';

/**
 * The sessions as the account screen lists them: this one first, then the most
 * recently signed in.
 */
export function sortSessions(sessions: AccountSession[]): AccountSession[] {
  return [...sessions].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

// English ordinals by hand: Hermes has no `Intl.PluralRules`.
function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return 'th';
  }
  return { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
}

/**
 * "Oct 26th 2026 12:24 PM", in `timeZone`, or the device's own zone without
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

  return `${parts.month} ${parts.day}${ordinal(Number(parts.day))} ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

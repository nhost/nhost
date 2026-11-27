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

function parts(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-US', options)
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
}

/**
 * "Oct 26th 2026 12:24 PM", in `timeZone`, or the device's own zone without
 * one.
 */
export function formatSessionTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  // Date and time apart: given both, Hermes on iOS returns the hour, minute
  // and AM/PM as literal parts.
  const { month, day, year } = parts(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  });
  const { hour, minute, dayPeriod } = parts(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });

  return `${month} ${day}${ordinal(Number(day))} ${year} ${hour}:${minute} ${dayPeriod}`;
}

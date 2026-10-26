import type { AccountSession } from '@/app/account/actions';
import {
  describeAddress,
  describeLocation,
  describeUserAgent,
} from '@/lib/nhost/session-metadata';

export type SessionSummary = {
  id: string;
  /** Device, location and address, as far as they are known. */
  details: string;
  /** When it was last used, or signed in if nothing was recorded since. */
  lastActive: string;
  current: boolean;
};

function lastActive(session: AccountSession): string {
  return session.metadata?.seenAt ?? session.createdAt;
}

/**
 * The sessions as the account page lists them: this one first, then the
 * most recently used.
 */
export function summarizeSessions(
  sessions: AccountSession[],
): SessionSummary[] {
  return [...sessions]
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        Date.parse(lastActive(b)) - Date.parse(lastActive(a)),
    )
    .map((session) => {
      const { metadata } = session;

      return {
        id: session.id,
        details: [
          describeUserAgent(metadata?.userAgent),
          metadata ? describeLocation(metadata) : undefined,
          describeAddress(metadata?.ip),
        ]
          .filter(Boolean)
          .join(', '),
        lastActive: lastActive(session),
        current: session.current,
      };
    });
}

const ordinals = new Intl.PluralRules('en-US', { type: 'ordinal' });
const SUFFIXES: Record<string, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
};

/**
 * "Oct 26th 2026 12:24", in `timeZone`, or the runtime's own zone without
 * one.
 */
export function formatSessionTime(iso: string, timeZone?: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    })
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, value]),
  );
  const suffix = SUFFIXES[ordinals.select(Number(parts.day))] ?? 'th';

  return `${parts.month} ${parts.day}${suffix} ${parts.year} ${parts.hour}:${parts.minute}`;
}

/**
 * What this app writes into a session's row in `auth.refresh_tokens`.
 *
 * The auth service records nothing about where a session is used from, but
 * the row has a `metadata` column it leaves empty for a browser session, and
 * rotation updates the row in place, so it lives as long as the session does.
 * The proxy writes it (see `trackSession` in `server.ts`) and the account page
 * lists it.
 *
 * The user role may write this column, so it is the visitor's own account of
 * their sessions, not an audit log: anyone can rewrite their own rows through
 * GraphQL.
 */
export type SessionMetadata = {
  ip?: string;
  userAgent?: string;
  country?: string;
  region?: string;
  city?: string;
  seenAt: string;
};

export type RequestDetails = Omit<SessionMetadata, 'seenAt'>;

// How stale `seenAt` may get before a navigation writes it again. Without
// this every page load would be a write; with it the account page's "active"
// time is at most this far behind.
export const SEEN_AT_INTERVAL_MS = 5 * 60 * 1000;

const MAX_USER_AGENT_LENGTH = 512;

// Vercel percent-encodes the city, which can carry any script.
function decoded(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// Cloudflare's placeholders for a country it could not place, and for Tor.
const UNKNOWN_COUNTRIES = new Set(['XX', 'T1']);

/**
 * Where a request came from, as far as its headers say.
 *
 * The address and the location are only as good as whatever sits in front of
 * the app. Vercel and Cloudflare set these headers themselves and overwrite
 * what the browser sent; a server that takes requests directly gets whatever
 * the browser chose to put in them. With neither host there is no location at
 * all, and the address is the one Next saw.
 */
export function requestDetails(headers: Headers): RequestDetails {
  const ip =
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const country =
    headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry');

  return {
    ip: ip || undefined,
    userAgent:
      headers.get('user-agent')?.slice(0, MAX_USER_AGENT_LENGTH) || undefined,
    country:
      country && !UNKNOWN_COUNTRIES.has(country.toUpperCase())
        ? country.toUpperCase()
        : undefined,
    region:
      decoded(headers.get('x-vercel-ip-country-region')) ??
      decoded(headers.get('cf-region')),
    city: decoded(headers.get('x-vercel-ip-city') ?? headers.get('cf-ipcity')),
  };
}

/**
 * Whether the stored metadata no longer describes this request: a new
 * address or browser, or a `seenAt` older than the interval.
 */
export function needsUpdate(
  stored: SessionMetadata | null | undefined,
  current: RequestDetails,
  now = Date.now(),
): boolean {
  if (!stored) {
    return true;
  }

  const changed = (Object.keys(current) as Array<keyof RequestDetails>).some(
    (name) => stored[name] !== current[name],
  );

  return changed || !(now - Date.parse(stored.seenAt) < SEEN_AT_INTERVAL_MS);
}

// Checked in order, so the browsers that put another's name in their user
// agent come before the one they name: Edge and Opera say Chrome, and every
// iOS browser says Safari.
const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(e|A|iOS)?\//, 'Edge'],
  [/\b(OPR|OPiOS)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\b(Chrome|CriOS|HeadlessChrome)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\biPhone\b/, 'iOS'],
  [/\biPad\b/, 'iPadOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b/, 'macOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bLinux\b/, 'Linux'],
];

/**
 * "Chrome - macOS", from a user agent. A guess, and good enough to tell a
 * phone from a laptop: a browser can claim to be anything. No versions: the
 * browsers freeze the system's in the user agent, so it would be wrong.
 */
export function describeUserAgent(userAgent: string | undefined): string {
  if (!userAgent) {
    return 'Unknown device';
  }

  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];

  if (browser && system) {
    return `${browser} - ${system}`;
  }

  return browser ?? system ?? 'Unknown device';
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * The city, or the country when the host did not name one.
 */
export function describeLocation(
  metadata: Pick<SessionMetadata, 'city' | 'country'>,
): string | undefined {
  return (
    metadata.city ??
    (metadata.country ? countryName(metadata.country) : undefined)
  );
}

const LOOPBACK = new Set(['::1', '127.0.0.1']);

/**
 * The address as someone would read it, or nothing for the loopback one:
 * running locally, the browser and Next are on the same machine, and `::1`
 * says nothing about where a session is. An IPv4 address that arrives in its
 * IPv6 form loses the prefix.
 */
export function describeAddress(ip: string | undefined): string | undefined {
  const address = ip?.replace(/^::ffff:/i, '');

  return address && !LOOPBACK.has(address) ? address : undefined;
}

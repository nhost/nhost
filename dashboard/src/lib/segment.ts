import { AnalyticsBrowser, type ID } from '@segment/analytics-next';
import { getCookieDomain } from '@/components/common/CookieConsent/consentCookie';
import { isPlatform } from '@/utils/env';
import { isDevOrStaging } from '@/utils/helpers';

// Segment is only loaded once the user accepts cookies (see CookieConsent).
// Until then, calls are buffered in memory and nothing is sent.
export const analytics = new AnalyticsBrowser();

let loaded = false;

/**
 * Analytics and ad tracking only run in production on Nhost Cloud. Elsewhere
 * the cookie banner still works, but nothing is loaded or sent.
 */
export function isAnalyticsEnabled() {
  return isPlatform() && !isDevOrStaging();
}

export function loadAnalytics() {
  if (loaded) {
    return;
  }

  loaded = true;
  analytics.load(
    {
      writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
    },
    {
      // Segment returns a no-op instance: nothing is fetched, stored or sent.
      disable: !isAnalyticsEnabled(),
    },
  );
}

// Keep these keys in sync with landing/src/lib/segment.ts: the cookies are shared.
const ANALYTICS_STORAGE_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
] as const;

/** Removes persisted identifiers without loading or waiting for Segment. */
export function clearAnalyticsStorage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const domain = getCookieDomain();

  for (const key of ANALYTICS_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be blocked independently of cookies.
    }

    const expiredCookie = `${key}=; Path=/; Max-Age=0`;
    // biome-ignore lint/suspicious/noDocumentCookie: cleanup must be synchronous
    document.cookie = expiredCookie;
    if (domain) {
      // biome-ignore lint/suspicious/noDocumentCookie: cleanup must be synchronous
      document.cookie = `${expiredCookie}; Domain=${domain}`;
    }
  }
}

export async function resetAnalytics() {
  clearAnalyticsStorage();
  if (loaded) {
    try {
      await analytics.reset();
    } finally {
      clearAnalyticsStorage();
    }
  }
}

export async function getAnonId(): Promise<ID> {
  if (!loaded) {
    return undefined;
  }

  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), 300);
  });

  try {
    return await Promise.race([
      analytics
        .user()
        .then((user) => user.anonymousId())
        .catch(() => undefined),
      timeout,
    ]);
  } catch (err) {
    console.error('Failed to get anonymous ID:', err);
    return undefined;
  }
}

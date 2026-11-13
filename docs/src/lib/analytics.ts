/**
 * Segment Analytics.js integration for Nhost Documentation.
 * Restores PostHog analytics forwarding via the nhost_dashboard Segment source.
 *
 * @see https://github.com/nhost/nhost/issues/5016
 */

/**
 * Returns the write key to use for Segment.
 * Configured via PUBLIC_ANALYTICS_WRITE_KEY environment variable.
 * Returns empty string if not set, disabling Segment analytics.
 */
export function getSegmentWriteKey(): string {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.PUBLIC_ANALYTICS_WRITE_KEY
  ) {
    return import.meta.env.PUBLIC_ANALYTICS_WRITE_KEY;
  }
  return '';
}

/**
 * Calculates the appropriate cookie domain for Analytics.js.
 * When on nhost.io or any subdomain (e.g. docs.nhost.io), returns '.nhost.io'
 * so anonymousId and user identity are shared across docs.nhost.io, nhost.io, and app.nhost.io.
 * On localhost or preview domains (e.g. Vercel previews), returns undefined to use standard host cookies.
 */
export function getCookieDomain(hostname?: string): string | undefined {
  const host =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  if (!host) return undefined;

  if (host === 'nhost.io' || host.endsWith('.nhost.io')) {
    return '.nhost.io';
  }
  return undefined;
}

export interface SegmentAnalytics {
  page: (properties?: Record<string, unknown>) => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify?: (userId?: string, traits?: Record<string, unknown>) => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    analytics?: SegmentAnalytics;
  }
}

/**
 * Emits a pageview event to Segment.
 */
export function trackPageview(properties?: Record<string, unknown>): void {
  try {
    if (typeof window !== 'undefined' && window.analytics?.page) {
      window.analytics.page(properties);
    }
  } catch (err) {
    console.error('[Analytics] Failed to track pageview:', err);
  }
}

/**
 * Emits a search query event.
 */
export function trackSearchQuery(query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('docs.search.query', {
        query: trimmed,
      });
    }
  } catch (err) {
    console.error('[Analytics] Failed to track search query:', err);
  }
}

/**
 * Emits a search result click event.
 */
export function trackSearchResultClick(
  query: string,
  url: string,
  title?: string,
): void {
  try {
    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('docs.search.result_click', {
        query: query.trim(),
        url,
        title: title?.trim(),
      });
    }
  } catch (err) {
    console.error('[Analytics] Failed to track search result click:', err);
  }
}

/**
 * Emits a code block copy event.
 */
export function trackCodeCopy(language?: string, code?: string): void {
  try {
    if (typeof window !== 'undefined' && window.analytics?.track) {
      const properties: Record<string, unknown> = {
        language: language || 'plaintext',
      };
      if (code) {
        properties.code = code.trim().slice(0, 300);
      }
      window.analytics.track('docs.code_block.copy', properties);
    }
  } catch (err) {
    console.error('[Analytics] Failed to track code copy:', err);
  }
}

/**
 * Emits a page feedback submission (helpful / not helpful).
 */
export function trackPageFeedback(
  helpful: boolean,
  path?: string,
  title?: string,
): void {
  try {
    const pagePath =
      path ?? (typeof window !== 'undefined' ? window.location.pathname : '');
    const pageTitle =
      title ?? (typeof document !== 'undefined' ? document.title : '');

    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('docs.page.feedback', {
        helpful,
        path: pagePath,
        title: pageTitle,
      });
    }
  } catch (err) {
    console.error('[Analytics] Failed to track page feedback:', err);
  }
}

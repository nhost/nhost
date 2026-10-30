import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

export type SettingsTabKey<T> = Extract<keyof T, string>;

/**
 * The tab to render for the `tab` query parameter. A missing or unknown tab
 * renders the default tab right away, and the URL is corrected in the
 * background so the sidebar highlights it. Returns `undefined` until the router
 * has parsed the query.
 */
export default function useActiveSettingsTab<T extends Record<string, unknown>>(
  tabs: T,
  defaultTab: SettingsTabKey<T>,
): SettingsTabKey<T> | undefined {
  const router = useRouter();
  const requestedTab = getSingleQueryParam(router.query.tab);
  const isKnownTab =
    requestedTab !== undefined && Object.hasOwn(tabs, requestedTab);

  useEffect(() => {
    if (!router.isReady || isKnownTab) {
      return;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: defaultTab },
      },
      undefined,
      { shallow: true },
    );
  }, [isKnownTab, defaultTab, router]);

  if (!router.isReady) {
    return undefined;
  }

  return isKnownTab ? (requestedTab as SettingsTabKey<T>) : defaultTab;
}

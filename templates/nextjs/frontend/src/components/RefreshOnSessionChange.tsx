'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isSignedIn } from '@/lib/nhost/signed-in';

/**
 * Renders the whole tree again when the session changed somewhere the nav
 * did not see.
 *
 * The nav is in the root layout, and Next does not render a layout again on a
 * client-side navigation, only the page under it. A session that ends outside
 * this tab, signed out in another one, revoked from another device, or
 * rejected when the proxy tried to refresh it, reaches the next page but not
 * the nav, which goes on showing the avatar over a page that says nobody is
 * signed in. Signing in from another tab leaves it stale the other way.
 *
 * After each navigation the proxy has either refreshed the session or deleted
 * it, and it writes or deletes the signed-in cookie with it, so whether
 * that cookie is there says what the page just rendered with. When that
 * disagrees with what the nav was rendered with, a refresh renders the layout
 * too. It runs again only when the path or the nav's answer changes, so a
 * refresh that changes nothing does not start another.
 *
 * A tab left open makes no navigation, so a session revoked from another
 * device would go on looking signed in there until the next click. Coming
 * back to the tab refreshes too, which sends a request through the proxy and
 * its check of the session (see `trackSession`). At most once per
 * `FOCUS_REFRESH_MS`, so moving between windows does not re-render the page
 * every time.
 */
export const FOCUS_REFRESH_MS = 5 * 60 * 1000;

export default function RefreshOnSessionChange({
  signedIn,
}: {
  signedIn: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not an input
  useEffect(() => {
    if (isSignedIn(document.cookie) !== signedIn) {
      router.refresh();
    }
  }, [pathname, signedIn, router]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let last = Date.now();
    const onReturn = (): void => {
      if (
        document.visibilityState !== 'visible' ||
        Date.now() - last < FOCUS_REFRESH_MS
      ) {
        return;
      }
      last = Date.now();
      router.refresh();
    };

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [signedIn, router]);

  return null;
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isSignedIn } from '@/lib/nhost/signed-in';

/**
 * Renders the whole tree again when the session changed somewhere the nav did
 * not see.
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

import { Redirect, useIsFocused, usePathname } from 'expo-router';
import { type ReactNode, useEffect, useMemo } from 'react';
import { type GuardResult, guard } from '@/guard';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { nhost } from '@/lib/nhost/client';
import { pendingPasswordReset } from '@/lib/nhost/passwordReset';
import { useSearch } from '@/lib/useSearch';
import {
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/screens/signin/lastUsed';

const STAY: GuardResult = {};

/**
 * Runs `guard` on every navigation to its screen, before the screen renders,
 * so a screen the user may not see never paints. A session that ends on the
 * screen does not run it again: whatever ended it navigates on its own.
 * Screens under the focused one in a stack keep rendering, but the location
 * is not theirs, so only the focused screen asks.
 */
export default function SessionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearch();
  const focused = useIsFocused();
  const { recheck } = useAuth();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation or a recheck is the trigger; the session is read fresh
  const verdict = useMemo(
    () =>
      focused
        ? guard({
            path: pathname,
            search,
            signedIn: !!nhost.getUserSession(),
            pendingReset: pendingPasswordReset(),
          })
        : STAY,
    [focused, pathname, search, recheck],
  );

  useEffect(() => {
    if (verdict.record) {
      recordSignInAttempt(verdict.record);
    }
    if (verdict.promote) {
      promoteSignInAttempt();
    }
  }, [verdict]);

  if (verdict.redirect) {
    return <Redirect href={verdict.redirect} />;
  }

  return children;
}

import { type ReactNode, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router';
import {
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/app/signin/lastUsed';
import { guard } from '@/guard';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { nhost } from '@/lib/nhost/client';
import { pendingPasswordReset } from '@/lib/nhost/passwordReset';

/**
 * Runs `guard` on every navigation, before the page renders, so a page the
 * visitor may not see never paints. A session that ends in this tab does not
 * run it again: whatever ended it navigates on its own.
 */
export default function SessionGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { recheck } = useAuth();

  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation or a recheck is the trigger; the session is read fresh
  const verdict = useMemo(
    () =>
      guard({
        path: location.pathname,
        search: location.search,
        signedIn: !!nhost.getUserSession(),
        pendingReset: pendingPasswordReset(),
      }),
    [location.key, recheck],
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
    return <Navigate replace to={verdict.redirect} />;
  }

  return children;
}

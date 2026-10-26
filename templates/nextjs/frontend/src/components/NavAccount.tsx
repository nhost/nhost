'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { signOutFinished, useSigningOut } from '@/components/useSignOut';

/**
 * The right of the nav: the account when there is a session, the ways in
 * when there is not.
 *
 * A reset link signs the visitor in, because changing the password takes a
 * session, but to them they are still signed out until the new password is
 * saved. Showing their avatar and a sign-out on that page reads as a sign-in
 * that never happened. So on the paths in `signedOutPaths` the nav shows the
 * signed-out side whatever the session says.
 *
 * Decided here rather than in `Nav` because the root layout is not told the
 * path, and it is not rendered again on a client-side navigation.
 *
 * A sign-out shows the ways in from the moment it starts, rather than once
 * the page has come back from the server signed out (see `useSignOut`).
 */
export default function NavAccount({
  signedIn,
  signedOut,
  signedOutPaths,
}: {
  signedIn: ReactNode;
  signedOut: ReactNode;
  signedOutPaths: string[];
}) {
  const pathname = usePathname();
  const signingOut = useSigningOut();
  const hasSession = Boolean(signedIn);
  const looksSignedOut = signedOutPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  useEffect(() => {
    if (!hasSession) {
      signOutFinished();
    }
  }, [hasSession]);

  return hasSession && !looksSignedOut && !signingOut ? signedIn : signedOut;
}

import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

/**
 * The right of the nav: the account when there is a session, the ways in when
 * there is not.
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
  const { pathname } = useLocation();
  const looksSignedOut = signedOutPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return signedIn && !looksSignedOut ? signedIn : signedOut;
}

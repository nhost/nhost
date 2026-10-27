'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

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
  const pathname = usePathname();
  const looksSignedOut = signedOutPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  return signedIn && !looksSignedOut ? signedIn : signedOut;
}

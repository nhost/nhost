'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_DESTINATION, signInHref } from '@/app/signin/destination';
import { Button } from '@/components/ui/button';

/**
 * "Sign in", and come back to this page afterwards.
 *
 * Reaching for sign-in from the nav or a status tile is not a request to go
 * anywhere: it is the same page, with a session. Only a link that was aimed
 * somewhere in particular, like the protected view, carries you on to it.
 *
 * A client component for one reason: the current path. A Server Component
 * would have to be handed it from every page that renders the nav.
 */
export function SignInLink({
  variant = 'default',
}: {
  variant?: 'default' | 'outline';
}) {
  const pathname = usePathname();

  // The sign-in page is not somewhere to come back to, and while the modal is
  // open the path already reads `/signin`.
  const next = pathname === '/signin' ? DEFAULT_DESTINATION : pathname;

  return (
    <Button asChild variant={variant} size="sm">
      <Link href={signInHref(next)}>Sign in</Link>
    </Button>
  );
}

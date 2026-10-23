'use client';

import { useRouter } from 'next/navigation';
import ConfirmInPlace from '@/app/account/ConfirmInPlace';
import { signOut } from '@/lib/nhost/actions';

/**
 * Signing out everywhere, which is the one worth a section.
 *
 * Signing out of this browser alone is in the nav, on every page. Repeating
 * it here only made the visitor choose between two buttons that read alike.
 *
 * Asked first, because this reaches past the browser it is clicked in: every
 * other device signed in to the account is signed out with it, and nothing
 * warns them.
 */
export default function SignOutCard() {
  const router = useRouter();

  const handleSignOut = async (): Promise<string | undefined> => {
    try {
      const result = await signOut({ all: true });
      if (result.error) {
        return result.error;
      }

      router.push('/');
      router.refresh();
      return undefined;
    } catch (err) {
      console.error('Error signing out:', err);
      return 'The request did not reach the server. Try again.';
    }
  };

  return (
    <ConfirmInPlace
      title="Sessions"
      description="Revokes every session this account holds, here and anywhere else."
      // Red like the delete below it: a visitor on another device loses
      // whatever they were doing, with no warning of their own.
      warning={
        <span className="text-destructive">
          Every device signed in to this account will be signed out, including
          this one.
        </span>
      }
      start="Sign out of all devices"
      confirm="Sign out everywhere"
      pending="Signing out…"
      destructive
      onConfirm={handleSignOut}
    />
  );
}

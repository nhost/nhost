'use client';

import { useSignOut } from '@/components/useSignOut';

/**
 * Sign out as a link in running text. A button underneath, since it acts
 * rather than goes anywhere.
 */
export default function SignOutLink({ children }: { children: string }) {
  const { isSigningOut, handleSignOut } = useSignOut();

  return (
    <button
      type="button"
      disabled={isSigningOut}
      onClick={() => void handleSignOut()}
      className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
    >
      {children}
    </button>
  );
}

'use client';

import { useSignOut } from '@/components/useSignOut';

/**
 * Sign out as a link in running text. A button underneath, since it acts
 * rather than goes anywhere, and inline throughout, error included, because
 * it sits inside a paragraph.
 */
export default function SignOutLink({ children }: { children: string }) {
  const { error, isSigningOut, handleSignOut } = useSignOut();

  return (
    <>
      <button
        type="button"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
        className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-default disabled:opacity-50"
      >
        {children}
      </button>
      {error ? (
        <span role="alert" className="text-destructive">
          {' '}
          ({error})
        </span>
      ) : null}
    </>
  );
}

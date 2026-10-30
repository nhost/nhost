'use client';

import { Button } from '@/components/ui/button';
import { useSignOut } from '@/components/useSignOut';

export default function SignOutButton() {
  const { error, isSigningOut, handleSignOut } = useSignOut();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

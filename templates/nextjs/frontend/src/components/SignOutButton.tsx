'use client';

import { Button } from '@/components/ui/button';
import { useSignOut } from '@/components/useSignOut';

export default function SignOutButton() {
  const { isSigningOut, handleSignOut } = useSignOut();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSigningOut}
      onClick={() => void handleSignOut()}
    >
      {isSigningOut ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}

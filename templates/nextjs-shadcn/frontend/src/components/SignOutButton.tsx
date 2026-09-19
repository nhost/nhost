'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/nhost/actions';

export default function SignOutButton() {
  const router = useRouter();

  const [error, setError] = useState<string | undefined>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setError(undefined);
    setIsSigningOut(true);
    try {
      const result = await signOut();
      if (result?.error) {
        setError(result.error);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

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

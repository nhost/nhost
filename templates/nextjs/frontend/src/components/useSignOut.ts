'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/nhost/actions';

/**
 * Signs out and goes home, for every control that offers it: the nav's
 * button and the link in the home page's steps.
 */
export function useSignOut() {
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

  return { error, isSigningOut, handleSignOut };
}

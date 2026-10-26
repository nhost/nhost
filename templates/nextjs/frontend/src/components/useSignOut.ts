'use client';

import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useToast } from '@/components/Toast';
import { signOut } from '@/lib/nhost/actions';

// Whether this tab is signing out, shared so the nav can show the ways in the
// moment a sign-out starts. The nav is only rendered signed out once the
// action has answered and the page has come back from the server, which on a
// deployed backend is long enough to see it show the sign-out button again
// in between.
let signingOut = false;
const listeners = new Set<VoidFunction>();

function setSigningOut(value: boolean): void {
  signingOut = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: VoidFunction): VoidFunction {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * True from the moment a sign-out starts until it turns out this browser is
 * still signed in, or the nav has been rendered signed out.
 */
export function useSigningOut(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => signingOut,
    () => false,
  );
}

/** For the nav, once the server has rendered it signed out. */
export function signOutFinished(): void {
  if (signingOut) {
    setSigningOut(false);
  }
}

/**
 * Signs out and goes home, for every control that offers it: the nav's
 * button, the link in the home page's steps, and this session's line on the
 * account page.
 *
 * The control that started it may be gone by the time an error comes back,
 * since the nav swaps its button for the ways in straight away, so errors are
 * a toast. Only one leaves this browser signed in, the server not answering,
 * and that one puts the nav back.
 */
export function useSignOut() {
  const router = useRouter();
  const toast = useToast();
  const isSigningOut = useSigningOut();

  const handleSignOut = async (): Promise<void> => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.stillSignedIn) {
        setSigningOut(false);
        toast(result.error ?? 'Could not sign out. Try again.');
        return;
      }

      if (result.error) {
        toast(result.error);
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error signing out:', err);
      setSigningOut(false);
      toast('The request did not reach the server. Try again.');
    }
  };

  return { isSigningOut, handleSignOut };
}

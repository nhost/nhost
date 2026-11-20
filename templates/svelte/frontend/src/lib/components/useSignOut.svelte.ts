import { signOut } from '#lib/nhost/actions.remote.ts';
import { NETWORK_ERROR } from '#lib/nhost/errors.ts';
import { goto } from '$app/navigation';

/**
 * Signs out and goes home, for every control that offers it: the nav's button,
 * the link in the home page's steps, and this session's line on the account
 * page.
 */
export function useSignOut() {
  let error = $state<string>();
  let isSigningOut = $state(false);

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) {
      return;
    }
    error = undefined;
    isSigningOut = true;

    try {
      const result = await signOut();
      if (result.stillSignedIn) {
        error = result.error;
        isSigningOut = false;
        return;
      }
    } catch (err) {
      console.error('Error signing out:', err);
      error = NETWORK_ERROR;
      isSigningOut = false;
      return;
    }

    // Stays pressed until the home page replaces this one. Every load runs
    // again, so the nav and the page drop the session, even on the home page.
    await goto('/', { refreshAll: true });
  };

  return {
    get error() {
      return error;
    },
    get isSigningOut() {
      return isSigningOut;
    },
    handleSignOut,
  };
}

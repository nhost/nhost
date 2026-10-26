'use client';

import { startTransition, useActionState } from 'react';
import { signOutAndGoHome } from '@/lib/nhost/actions';

/**
 * Signs out and goes home, for every control that offers it: the nav's
 * button, the link in the home page's steps, and this session's line on the
 * account page.
 *
 * One request does both (see `signOutAndGoHome`), and `isSigningOut` holds
 * until the home page is on screen, so the control does not go back to
 * "Sign out" while the page is on its way.
 */
export function useSignOut() {
  const [state, dispatch, isSigningOut] = useActionState(signOutAndGoHome, {});

  const handleSignOut = (): void => {
    startTransition(dispatch);
  };

  return { error: state.error, isSigningOut, handleSignOut };
}

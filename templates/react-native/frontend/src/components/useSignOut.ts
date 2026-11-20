import { startTransition, useActionState } from 'react';
import { goTo } from '@/lib/goTo';
import { signOut } from '@/lib/nhost/actions';
import type { ActionResult } from '@/lib/nhost/errors';

/**
 * Signs out and goes home, for every control that offers it: the nav's button
 * and the link in the home screen's steps.
 */
export function useSignOut() {
  const [state, dispatch, isSigningOut] = useActionState(
    async (): Promise<ActionResult> => {
      const result = await signOut();

      if (result.stillSignedIn) {
        return { error: result.error };
      }

      goTo('/');
      return {};
    },
    {},
  );

  const handleSignOut = (): void => {
    startTransition(dispatch);
  };

  return { error: state.error, isSigningOut, handleSignOut };
}

import { startTransition, useActionState } from 'react';
import { useNavigate } from 'react-router';
import { signOut } from '@/lib/nhost/actions';
import type { ActionResult } from '@/lib/nhost/errors';

/**
 * Signs out and goes home, for every control that offers it: the nav's button,
 * the link in the home page's steps, and this session's line on the account
 * page.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const [state, dispatch, isSigningOut] = useActionState(
    async (): Promise<ActionResult> => {
      const result = await signOut();

      if (result.stillSignedIn) {
        return { error: result.error };
      }

      await navigate('/', { replace: true });
      return {};
    },
    {},
  );

  const handleSignOut = (): void => {
    startTransition(dispatch);
  };

  return { error: state.error, isSigningOut, handleSignOut };
}

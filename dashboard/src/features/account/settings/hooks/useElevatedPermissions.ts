import { useElevateEmail } from '@/hooks/useElevateEmail';
import { useHasuraClaims } from '@/hooks/useHasuraClaims';

import { useUserData } from '@/hooks/useUserData';
import { getToastStyleProps } from '@/utils/constants/settings';
import { toast } from 'react-hot-toast';

function useElevatedPermissions() {
  const user = useUserData();
  const elevateEmail = useElevateEmail();
  const claims = useHasuraClaims();

  async function elevatePermissions(shouldThrowError = false) {
    const elevated = user
      ? claims?.['x-hasura-auth-elevated'] === user?.id
      : false;
    if (elevated) {
      return true;
    }
    try {
      await elevateEmail();
      return true;
    } catch (e) {
      if (shouldThrowError) {
        throw e;
      } else {
        const message = e?.message || 'Could not elevate permissions';
        toast.error(message, getToastStyleProps());
        return false;
      }
    }
  }

  return elevatePermissions;
}

export default useElevatedPermissions;

import { getToastStyleProps } from '@/utils/constants/settings';
import { useElevateSecurityKeyEmail, useUserData } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';

function useElevatedPermissions() {
  const user = useUserData();

  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail();

  async function elevatePermissions(shouldThrowError = false) {
    if (elevated) {
      return true;
    }
    try {
      const response = await elevateEmailSecurityKey(user.email);
      if (response.isError) {
        const errorMessage =
          response.error?.message || 'Permissions were not elevated';
        throw new Error(errorMessage);
      }
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

  return { elevated, elevatePermissions };
}

export default useElevatedPermissions;

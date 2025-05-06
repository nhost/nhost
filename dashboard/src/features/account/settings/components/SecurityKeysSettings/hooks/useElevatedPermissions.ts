import { useElevateSecurityKeyEmail, useUserData } from '@nhost/nextjs';
import { toast } from 'react-hot-toast';

function useElevatedPermissions() {
  const user = useUserData();

  const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail();

  async function elevatePermissions() {
    try {
      const response = await elevateEmailSecurityKey(user.email);
      if (response.isError) {
        const errorMessage =
          response.error?.message || 'Permissions were not elevated';
        throw new Error(errorMessage);
      }
      return true;
    } catch (e) {
      const message = e?.message || 'Could not elevate permissions';
      toast.error(message);
      return false;
    }
  }

  return { elevated, elevatePermissions };
}

export default useElevatedPermissions;

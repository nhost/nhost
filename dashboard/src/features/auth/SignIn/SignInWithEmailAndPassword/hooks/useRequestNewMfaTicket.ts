import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignInEmailPassword } from '@nhost/nextjs';
import toast from 'react-hot-toast';

function useRequestNewMfaTicket() {
  const { signInEmailPassword } = useSignInEmailPassword();
  async function requestNewMfaTicket(email: string, password: string) {
    try {
      const { error } = await signInEmailPassword(email, password);
      if (error) {
        toast.error(
          error?.message ||
            'An error occurred while verifying TOTP. Please try again.',
          getToastStyleProps(),
        );
      }
    } catch (error) {
      toast.error(
        'An error occurred while trying to verify TOTP.',
        getToastStyleProps(),
      );
    }
  }

  return requestNewMfaTicket;
}

export default useRequestNewMfaTicket;

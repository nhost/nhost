import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import toast from 'react-hot-toast';

function useRequestNewMfaTicket() {
  const nhost = useNhostClient();
  async function requestNewMfaTicket(email: string, password: string) {
    let mfaTicket: string;
    try {
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });
      mfaTicket = response.body?.mfa.ticket;
    } catch (error) {
      toast.error(
        error?.message ||
          'An error occurred while verifying TOTP. Please try again.',
        getToastStyleProps(),
      );
    }

    return mfaTicket;
  }

  return requestNewMfaTicket;
}

export default useRequestNewMfaTicket;

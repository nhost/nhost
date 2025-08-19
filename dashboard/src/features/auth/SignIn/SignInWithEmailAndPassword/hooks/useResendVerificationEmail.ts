import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function useResendVerificationEmail() {
  const nhost = useNhostClient();
  const [loading, setLoading] = useState(false);

  const resendVerificationEmail = async (email: string) => {
    setLoading(true);

    try {
      await nhost.auth.sendVerificationEmail({ email });

      toast.success(
        `A new email has been sent to ${email}. Please follow the link to verify your email address and to
      complete your registration.`,
        getToastStyleProps(),
      );
    } catch {
      toast.error(
        'An error occurred while sending the verification email. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      setLoading(false);
    }
  };

  return { resendVerificationEmail, loading };
}

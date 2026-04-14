import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { appendPkceId, generateAndStorePKCE } from '@/lib/pkce';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

export default function useResendVerificationEmail() {
  const nhost = useNhostClient();
  const [loading, setLoading] = useState(false);

  const resendVerificationEmail = async (email: string) => {
    setLoading(true);

    try {
      const { challenge, id } = await generateAndStorePKCE();

      await nhost.auth.sendVerificationEmail({
        email,
        codeChallenge: challenge,
        options: {
          redirectTo: appendPkceId(window.location.origin, id),
        },
      });

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

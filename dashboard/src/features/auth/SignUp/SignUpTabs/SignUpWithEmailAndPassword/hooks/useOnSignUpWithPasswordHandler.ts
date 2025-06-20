import { getAnonId } from '@/lib/segment';
import { isEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import type { SignUpWithEmailAndPasswordFormValues } from './useSignUpWithEmailAndPasswordForm';

function useOnSignUpWithPasswordHandler() {
  const nhost = useNhostClient();
  const router = useRouter();

  async function onSignUpWithPassword({
    email,
    password,
    displayName,
    turnstileToken,
  }: SignUpWithEmailAndPasswordFormValues) {
    try {
      const response = await nhost.auth.signUpEmailPassword(
        {
          email,
          password,
          options: {
            displayName,
            metadata: { anonId: await getAnonId() },
          },
        },
        {
          headers: {
            'x-cf-turnstile-response': turnstileToken,
          },
        },
      );

      if (response.status === 200 && isEmptyValue(response.body)) {
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      toast.error(
        error.message ||
          'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  return onSignUpWithPassword;
}

export default useOnSignUpWithPasswordHandler;

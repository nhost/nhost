import { getAnonId } from '@/lib/segment';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import type { SignUpWithEmailAndPasswordFormValues } from './useSignUpWithEmailAndPasswordForm';

function useOnSignUpWithPasswordHandler() {
  const { signUpEmailPassword } = useSignUpEmailPassword();
  const router = useRouter();

  async function onSignUpWithPassword({
    email,
    password,
    displayName,
    turnstileToken,
  }: SignUpWithEmailAndPasswordFormValues) {
    try {
      const { needsEmailVerification, error } = await signUpEmailPassword(
        email,
        password,
        {
          displayName,
          metadata: { anonId: await getAnonId() },
        },
        {
          headers: {
            'x-cf-turnstile-response': turnstileToken,
          },
        },
      );

      if (error) {
        toast.error(
          error.message ||
            'An error occurred while signing up. Please try again.',
          getToastStyleProps(),
        );
        return;
      }

      if (needsEmailVerification) {
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch {
      toast.error(
        'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  return onSignUpWithPassword;
}

export default useOnSignUpWithPasswordHandler;

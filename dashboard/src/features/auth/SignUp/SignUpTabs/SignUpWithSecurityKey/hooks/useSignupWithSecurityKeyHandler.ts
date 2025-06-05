import { getAnonId } from '@/lib/segment';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignUpEmailSecurityKeyEmail } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import type { SignUpWithSecurityKeyFormValues } from './useSignupWithSecurityKeyForm';

function useOnSignUpWithSecurityKeyHandler() {
  const { signUpEmailSecurityKey } = useSignUpEmailSecurityKeyEmail();
  const router = useRouter();

  async function onSignUpWithSecurityKey({
    email,
    displayName,
    turnstileToken,
  }: SignUpWithSecurityKeyFormValues) {
    try {
      const { needsEmailVerification, error } = await signUpEmailSecurityKey(
        email,
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

  return onSignUpWithSecurityKey;
}

export default useOnSignUpWithSecurityKeyHandler;

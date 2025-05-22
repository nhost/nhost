import { getAnonId } from '@/lib/segment';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignUpEmailSecurityKeyEmail } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { SignUpWithSecurityKeyFormValues } from './useSignupWithSecurityKeyForm';

function useOnSignUpWithSecurityKeyHandler() {
  const { signUpEmailSecurityKey, error } = useSignUpEmailSecurityKeyEmail();
  const router = useRouter();
  const hasFormBeenSubmitted = useRef(false);

  useEffect(() => {
    if (hasFormBeenSubmitted.current && error) {
      toast.error(
        error?.message ||
          'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    }
  }, [error]);

  async function onSignUpWithSecurityKey({
    email,
    displayName,
    turnstileToken,
  }: SignUpWithSecurityKeyFormValues) {
    try {
      const { needsEmailVerification } = await signUpEmailSecurityKey(
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

      if (needsEmailVerification) {
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch {
      toast.error(
        'An error occurred while signing up. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      hasFormBeenSubmitted.current = true;
    }
  }

  return onSignUpWithSecurityKey;
}

export default useOnSignUpWithSecurityKeyHandler;

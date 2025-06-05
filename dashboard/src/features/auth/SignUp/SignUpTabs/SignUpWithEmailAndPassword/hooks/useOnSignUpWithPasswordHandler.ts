import { getAnonId } from '@/lib/segment';
import { getToastStyleProps } from '@/utils/constants/settings';
import { useSignUpEmailPassword } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { SignUpWithEmailAndPasswordFormValues } from './useSignUpWithEmailAndPasswordForm';

function useOnSignUpWithPasswordHandler() {
  const { signUpEmailPassword, error } = useSignUpEmailPassword();
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

  async function onSignUpWithPassword({
    email,
    password,
    displayName,
    turnstileToken,
  }: SignUpWithEmailAndPasswordFormValues) {
    try {
      const { needsEmailVerification } = await signUpEmailPassword(
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

  return onSignUpWithPassword;
}

export default useOnSignUpWithPasswordHandler;

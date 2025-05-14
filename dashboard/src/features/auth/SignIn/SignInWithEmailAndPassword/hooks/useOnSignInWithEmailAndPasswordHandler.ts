import { getToastStyleProps } from '@/utils/constants/settings';
import {
  useSendVerificationEmail,
  useSignInEmailPassword,
} from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { SignInWithEmailAndPasswordFormValues } from './useSignInWithEmailAndPasswordForm';

function useOnSignInWithEmailAndPasswordHandler() {
  const router = useRouter();
  const { signInEmailPassword, error, needsMfaOtp, sendMfaOtp, isLoading } =
    useSignInEmailPassword();
  const { sendEmail } = useSendVerificationEmail();

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

  async function onSignIWithEmailAndPassword({
    email,
    password,
  }: SignInWithEmailAndPasswordFormValues) {
    try {
      const { needsEmailVerification } = await signInEmailPassword(
        email,
        password,
      );

      if (needsEmailVerification) {
        await sendEmail(email);
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch {
      toast.error(
        'An error occurred while signing in. Please try again.',
        getToastStyleProps(),
      );
    } finally {
      hasFormBeenSubmitted.current = true;
    }
  }

  return { onSignIWithEmailAndPassword, needsMfaOtp, sendMfaOtp, isLoading };
}

export default useOnSignInWithEmailAndPasswordHandler;

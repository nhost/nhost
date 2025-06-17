import { getToastStyleProps } from '@/utils/constants/settings';
import {
  useSendVerificationEmail,
  useSignInEmailPassword,
} from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import type { SignInWithEmailAndPasswordFormValues } from './useSignInWithEmailAndPasswordForm';

type EmailPasswordRef = {
  email: string;
  password: string;
} | null;

function useOnSignInWithEmailAndPasswordHandler() {
  const router = useRouter();
  const { signInEmailPassword, needsMfaOtp, sendMfaOtp, isLoading } =
    useSignInEmailPassword();
  const emailPasswordRef = useRef<EmailPasswordRef>(null);

  const { sendEmail } = useSendVerificationEmail();

  async function onSignInWithEmailAndPassword({
    email,
    password,
  }: SignInWithEmailAndPasswordFormValues) {
    try {
      const { needsEmailVerification, error } = await signInEmailPassword(
        email,
        password,
      );
      emailPasswordRef.current = {
        email,
        password,
      };
      if (error) {
        toast.error(
          error?.message ||
            'An error occurred while signing in. Please try again.',
          getToastStyleProps(),
        );
        return;
      }

      if (needsEmailVerification) {
        await sendEmail(email);
        router.push(`/email/verify?email=${encodeURIComponent(email)}`);
      }
    } catch {
      toast.error(
        'An error occurred while signing in. Please try again.',
        getToastStyleProps(),
      );
    }
  }

  return {
    onSignInWithEmailAndPassword,
    needsMfaOtp,
    sendMfaOtp,
    isLoading,
    emailPasswordRef,
  };
}

export default useOnSignInWithEmailAndPasswordHandler;

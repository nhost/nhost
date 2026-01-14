import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import type { SignInWithEmailAndPasswordFormValues } from './useSignInWithEmailAndPasswordForm';

interface Props {
  onNeedsMfa: (mfaTicket: string) => void;
}

type EmailAndPasswordRef = {
  email: string;
  password: string;
} | null;

function useOnSignInWithEmailAndPasswordHandler({ onNeedsMfa }: Props) {
  const [isLoading, setIsloading] = useState(false);
  const nhost = useNhostClient();
  const router = useRouter();
  const emailAndPasswordRef = useRef<EmailAndPasswordRef>();

  async function onSignInWithEmailAndPassword({
    email,
    password,
  }: SignInWithEmailAndPasswordFormValues) {
    try {
      setIsloading(true);
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

      emailAndPasswordRef.current = {
        email,
        password,
      };
      if (response.body.mfa) {
        onNeedsMfa(response.body.mfa.ticket);
      }
    } catch (error) {
      let errorMessage =
        error?.message ||
        'An error occurred while signing in. Please try again.';

      if (isNotEmptyValue(error?.body)) {
        const errorCode = error.body.error;
        if (errorCode === 'unverified-user') {
          await nhost.auth.sendVerificationEmail({ email });
          router.push(`/email/verify?email=${encodeURIComponent(email)}`);
          return;
        }
        errorMessage = error.body.message;
      }
      toast.error(errorMessage, getToastStyleProps());
    } finally {
      setIsloading(false);
    }
  }

  return { onSignInWithEmailAndPassword, isLoading, emailAndPasswordRef };
}

export default useOnSignInWithEmailAndPasswordHandler;

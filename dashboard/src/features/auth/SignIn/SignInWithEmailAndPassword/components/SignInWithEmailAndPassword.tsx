import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import useOnSignInWithEmailAndPasswordHandler from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useOnSignInWithEmailAndPasswordHandler';
import { isNotEmptyValue } from '@/lib/utils';
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';
import MfaSignInOtpForm from './MfaSignInOtpForm';
import SignInWithEmailAndPasswordForm from './SignInWithEmailAndPasswordForm';

function SignInWithEmailAndPassword() {
  const [needsMfaOtp, setNeedsMfaOtp] = useState(false);
  const mfaTicket = useRef<string | undefined>();
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const nhost = useNhostClient();

  function onNeedsMfa(ticket: string) {
    mfaTicket.current = ticket;
    setNeedsMfaOtp(true);
  }

  const { onSignInWithEmailAndPassword, isLoading, emailAndPasswordRef } =
    useOnSignInWithEmailAndPasswordHandler({ onNeedsMfa });

  async function requestNewMfaTicket() {
    if (isNotEmptyValue(emailAndPasswordRef.current)) {
      try {
        const { email, password } = emailAndPasswordRef.current;
        const response = await nhost.auth.signInEmailPassword({
          email,
          password,
        });
        if (isNotEmptyValue(response.body?.mfa?.ticket)) {
          mfaTicket.current = response.body.mfa.ticket;
        }
      } catch (error) {
        toast.error(
          error?.message ||
            'An error occurred while verifying TOTP. Please try again.',
          getToastStyleProps(),
        );
      }
    }
  }

  async function onHandleSendMfaOtp(otp: string) {
    try {
      setIsMfaLoading(true);
      await nhost.auth.verifySignInMfaTotp({
        ticket: mfaTicket.current!,
        otp,
      });
    } finally {
      setIsMfaLoading(false);
    }
  }

  return needsMfaOtp ? (
    <MfaSignInOtpForm
      sendMfaOtp={onHandleSendMfaOtp}
      loading={isMfaLoading}
      requestNewMfaTicket={requestNewMfaTicket}
    />
  ) : (
    <SignInWithEmailAndPasswordForm
      onSubmit={onSignInWithEmailAndPassword}
      isLoading={isLoading}
    />
  );
}

export default SignInWithEmailAndPassword;

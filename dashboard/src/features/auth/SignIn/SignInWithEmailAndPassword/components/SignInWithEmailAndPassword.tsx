import useOnSignInWithEmailAndPasswordHandler from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useOnSignInWithEmailAndPasswordHandler';
import useRequestNewMfaTicket from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useRequestNewMfaTicket';
import { useNhostClient } from '@/providers/nhost';
import { useRef, useState } from 'react';
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
  const requestNewMfaTicketFn = useRequestNewMfaTicket();

  async function requestNewMfaTicket() {
    const { email, password } = emailAndPasswordRef.current;
    mfaTicket.current = await requestNewMfaTicketFn(email, password);
  }

  async function onHandleSendMfaOtp(otp: string) {
    try {
      setIsMfaLoading(true);
      await nhost.auth.verifySignInMfaTotp({
        ticket: mfaTicket.current,
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

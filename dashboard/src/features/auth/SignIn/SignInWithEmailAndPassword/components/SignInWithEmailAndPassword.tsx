import useOnSignInWithEmailAndPasswordHandler from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useOnSignInWithEmailAndPasswordHandler';
import useRequestNewMfaTicket from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useRequestNewMfaTicket';
import MfaSignInOtpForm from './MfaSignInOtpForm';
import SignInWithEmailAndPasswordForm from './SignInWithEmailAndPasswordForm';

function SignInWithEmailAndPassword() {
  const {
    onSignInWithEmailAndPassword,
    sendMfaOtp,
    isLoading,
    needsMfaOtp,
    emailPasswordRef,
  } = useOnSignInWithEmailAndPasswordHandler();
  const requestNewMfaTicketFn = useRequestNewMfaTicket();

  async function requestNewMfaTicket() {
    const { email, password } = emailPasswordRef.current;
    await requestNewMfaTicketFn(email, password);
  }

  return needsMfaOtp ? (
    <MfaSignInOtpForm
      sendMfaOtp={sendMfaOtp}
      loading={isLoading}
      requestNewMfaTicket={requestNewMfaTicket}
    />
  ) : (
    <SignInWithEmailAndPasswordForm onSubmit={onSignInWithEmailAndPassword} />
  );
}

export default SignInWithEmailAndPassword;

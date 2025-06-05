import useOnSignUpWithPasswordHandler from '@/features/auth/SignIn/SignInWithEmailAndPassword/hooks/useOnSignInWithEmailAndPasswordHandler';
import MfaSignInOtpForm from './MfaSignInOtpForm';
import SignInWithEmailAndPasswordForm from './SignInWithEmailAndPasswordForm';

function SignInWithEmailAndPassword() {
  const { onSignIWithEmailAndPassword, sendMfaOtp, isLoading, needsMfaOtp } =
    useOnSignUpWithPasswordHandler();

  return needsMfaOtp ? (
    <MfaSignInOtpForm sendMfaOtp={sendMfaOtp} loading={isLoading} />
  ) : (
    <SignInWithEmailAndPasswordForm onSubmit={onSignIWithEmailAndPassword} />
  );
}

export default SignInWithEmailAndPassword;

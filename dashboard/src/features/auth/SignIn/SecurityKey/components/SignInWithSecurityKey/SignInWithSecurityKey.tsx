import { Button } from '@/components/ui/v3/button';
import { useSignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey/hooks/useSignInWithSecurityKey';
import { Fingerprint } from 'lucide-react';
import { VerifyEmailDialog } from './VerifyEmailDialog';

function SignInWithSecurityKey() {
  const { disabled, signInWithSecurityKey, needsEmailVerification } =
    useSignInWithSecurityKey();
  return (
    <>
      <VerifyEmailDialog needsEmailVerification={needsEmailVerification} />
      <Button
        variant="ghost"
        className="gap-2 !bg-white text-sm+ !text-black hover:ring-2 hover:ring-white hover:ring-opacity-50 disabled:!text-black disabled:!text-opacity-60"
        disabled={disabled}
        onClick={signInWithSecurityKey}
      >
        <Fingerprint size={14} />
        Continue with a security key
      </Button>
    </>
  );
}

export default SignInWithSecurityKey;

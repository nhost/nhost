import { Fingerprint } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { useSignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey/hooks/useSignInWithSecurityKey';
import { VerifyEmailDialog } from './VerifyEmailDialog';

function SignInWithSecurityKey() {
  const [open, setOpen] = useState(false);
  function onNeedsEmailVerification() {
    setOpen(true);
  }
  const { disabled, signInWithSecurityKey } = useSignInWithSecurityKey({
    onNeedsEmailVerification,
  });
  return (
    <>
      <VerifyEmailDialog open={open} setOpen={setOpen} />
      <Button
        variant="outline-emboss"
        className="gap-2 text-sm+"
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

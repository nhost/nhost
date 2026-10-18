import { Fingerprint } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { useSignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey/hooks/useSignInWithSecurityKey';
import { cn } from '@/lib/utils';
import { VerifyEmailDialog } from './VerifyEmailDialog';

export interface SignInWithSecurityKeyProps {
  className?: string;
  'aria-describedby'?: string;
}

function SignInWithSecurityKey({
  className,
  'aria-describedby': ariaDescribedBy,
}: SignInWithSecurityKeyProps) {
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
        className={cn('w-full gap-2 text-sm+', className)}
        disabled={disabled}
        onClick={signInWithSecurityKey}
        aria-describedby={ariaDescribedBy}
      >
        <Fingerprint />
        Continue with a security key
      </Button>
    </>
  );
}

export default SignInWithSecurityKey;

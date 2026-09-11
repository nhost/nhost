import { Fingerprint } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { useSignInWithSecurityKey } from '@/features/auth/SignIn/SecurityKey/hooks/useSignInWithSecurityKey';
import { cn } from '@/lib/utils';
import { VerifyEmailDialog } from './VerifyEmailDialog';

export interface SignInWithSecurityKeyProps {
  className?: string;
}

function SignInWithSecurityKey({ className }: SignInWithSecurityKeyProps) {
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
        variant="ghost"
        className={cn(
          '!bg-white !text-black disabled:!text-black disabled:!text-opacity-60 w-full gap-2 text-sm+ hover:ring-2 hover:ring-white hover:ring-opacity-50',
          className,
        )}
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

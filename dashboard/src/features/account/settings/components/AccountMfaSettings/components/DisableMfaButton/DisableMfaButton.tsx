import { MfaOtpForm } from '@/components/common/MfaOtpForm';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import useMfaEnabled from '@/features/account/settings/components/AccountMfaSettings/hooks/useMfaEnabled';
import useActionWithElevatedPermissions from '@/features/account/settings/hooks/useActionWithElevatedPermissions';
import { useConfigMfa } from '@nhost/nextjs';
import { useState } from 'react';

const successMessage = 'Multi-factor authentication has been disabled.';

function DisableMfaButton() {
  const { disableMfa: actionFn, isDisabling } = useConfigMfa();
  const [open, setOpen] = useState(false);
  const { loading, refetch } = useMfaEnabled();
  const buttonDisabled = loading || isDisabling;

  async function onSuccess() {
    setOpen(false);
    await refetch();
  }

  const disableMfa = useActionWithElevatedPermissions({
    actionFn,
    successMessage,
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={buttonDisabled}
          className="p-y[0.375rem] h-9 gap-2 border-destructive px-2 text-destructive hover:bg-destructive"
        >
          Disable multi-factor authentication
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[9999] max-w-[28rem] text-foreground">
        <DialogHeader>
          <DialogTitle>Disable multi-factor authentication</DialogTitle>
        </DialogHeader>
        <DialogDescription className="hidden">
          Disable multi-factor authentication
        </DialogDescription>

        <MfaOtpForm loading={isDisabling} sendMfaOtp={disableMfa} />
      </DialogContent>
    </Dialog>
  );
}

export default DisableMfaButton;

import { useState } from 'react';
import { toast } from 'react-hot-toast';
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
import { useNhostClient } from '@/providers/nhost';
import { getToastStyleProps } from '@/utils/constants/settings';

function DisableMfaButton() {
  const nhost = useNhostClient();
  const [open, setOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const { loading, refetch } = useMfaEnabled();
  const buttonDisabled = loading || isDisabling;

  async function onSendMfaOtp(code: string) {
    try {
      setIsDisabling(true);
      await nhost.auth.verifyChangeUserMfa({
        code,
        activeMfaType: '',
      });
      toast.success(
        'Multi-factor authentication has been disabled.',
        getToastStyleProps(),
      );
      await refetch();
      setOpen(false);
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={buttonDisabled}
          className="h-9 gap-2 border-destructive p-y[0.375rem] px-2 text-destructive hover:bg-destructive hover:text-white"
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

        <MfaOtpForm loading={isDisabling} sendMfaOtp={onSendMfaOtp} />
      </DialogContent>
    </Dialog>
  );
}

export default DisableMfaButton;

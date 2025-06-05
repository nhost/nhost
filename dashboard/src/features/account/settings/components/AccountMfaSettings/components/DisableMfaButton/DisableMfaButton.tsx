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
import { getToastStyleProps } from '@/utils/constants/settings';
import { useConfigMfa } from '@nhost/nextjs';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

const defaultErrorMessage =
  'An error occurred while trying to enable multi-factor authentication. Please try again.';

function DisableMfaButton() {
  const { disableMfa, isDisabling } = useConfigMfa();
  const [open, setOpen] = useState(false);
  const { loading, refetch } = useMfaEnabled();
  const buttonDisabled = loading || isDisabling;

  async function onSendMfaOtp(code: string) {
    const result = await disableMfa(code);
    if (result.error) {
      toast.error(
        result.error.message || defaultErrorMessage,
        getToastStyleProps(),
      );
      return false;
    }
    toast.success(
      'Multi-factor authentication has been disabled.',
      getToastStyleProps(),
    );
    await refetch();
    setOpen(false);

    return true;
  }

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

        <MfaOtpForm loading={isDisabling} sendMfaOtp={onSendMfaOtp} />
      </DialogContent>
    </Dialog>
  );
}

export default DisableMfaButton;

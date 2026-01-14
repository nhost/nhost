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
import { useState } from 'react';
import MfaQRCodeAndTOTPSecret from './MfaQRCodeAndTOTPSecret';

function EnableMfaButton() {
  const [open, setOpen] = useState(false);
  const { isMfaEnabled, loading, refetch } = useMfaEnabled();
  const buttonDisabled = loading || isMfaEnabled;

  async function handleOnSuccess() {
    setOpen(false);
    await refetch();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={buttonDisabled}
          className="h-9 gap-2 border-green-600 p-y[0.375rem] px-2 text-green-600 hover:bg-destructive hover:bg-green-600"
        >
          Enable multi-factor authentication
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[9999] max-w-[28rem] text-foreground">
        <DialogHeader>
          <DialogTitle>Enable multi-factor authentication</DialogTitle>
        </DialogHeader>
        <DialogDescription className="hidden">
          Enable multi-factor authentication
        </DialogDescription>
        <MfaQRCodeAndTOTPSecret onSuccess={handleOnSuccess} />
      </DialogContent>
    </Dialog>
  );
}

export default EnableMfaButton;

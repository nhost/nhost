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
import { Plus } from 'lucide-react';
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
          variant="ghost"
          disabled={buttonDisabled}
          className="p-y[0.375rem] h-9 gap-2 px-2 hover:bg-[#d6eefb] dark:hover:bg-[#1e2942]"
        >
          <Plus className="h-5 w-5" />
          Generate QR code and TOTP secret
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

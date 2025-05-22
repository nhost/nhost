import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { useEffect, useState } from 'react';

interface Props {
  needsEmailVerification: boolean;
}

export function VerifyEmailDialog({ needsEmailVerification }: Props) {
  const [open, setOpen] = useState(needsEmailVerification);

  useEffect(() => {
    setOpen(needsEmailVerification);
  }, [needsEmailVerification, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Email verification required</DialogTitle>
          <DialogDescription>
            You need to verify your email first. Please check your mailbox and
            follow the confirmation link to complete the registration.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

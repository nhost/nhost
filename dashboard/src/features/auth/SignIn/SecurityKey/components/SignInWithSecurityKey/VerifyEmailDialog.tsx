import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';

interface Props {
  open: boolean;
  setOpen: (openState: boolean) => void;
}

export function VerifyEmailDialog({ open, setOpen }: Props) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="text-foreground sm:max-w-[425px]">
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

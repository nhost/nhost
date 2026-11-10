import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import SecurityKeyForm from '@/features/account/settings/components/SecurityKeysSettings/components/NewSecurityKeyForm';

function AddSecurityKeyButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PlusIcon className="mr-2 h-4 w-4" />
          Add passkey
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[9999] p-12 text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl leading-7 tracking-normal">
            Add a passkey
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">Add a passkey</DialogDescription>
        <SecurityKeyForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export default AddSecurityKeyButton;

import { Plus } from 'lucide-react';
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
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Plus className="h-5 w-5" />
          Add New Security Key
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[9999] p-12 text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Add a Security Key</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Add a Security Key
        </DialogDescription>
        <SecurityKeyForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export default AddSecurityKeyButton;

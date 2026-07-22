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

import SecurityKeyForm from './NewSecurityKeyForm';

function AddSecurityKeyButton() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-primary-main hover:bg-primary-highlight hover:text-primary-main"
        >
          <Plus className="h-5 w-5" />
          Add New Security Key
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sr z-[9999] text-foreground sm:max-w-xl"
        aria-describedby="Add a Security Key"
      >
        <DialogHeader>
          <DialogTitle>Add a Security Key</DialogTitle>
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

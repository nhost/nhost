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
          variant="ghost"
          className="h-9 gap-2 px-2 py-[0.375rem] hover:bg-[#d6eefb] dark:hover:bg-[#1e2942]"
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

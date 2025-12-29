import { Button } from '@/components/ui/v3/button';
import { Plus } from 'lucide-react';

export default function CreateCronTriggerForm() {
  return (
    <Button
      variant="link"
      className="mt-1 flex w-full justify-between px-[0.625rem] !text-sm+ text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
      aria-label="Add cron trigger"
    >
      New Cron Trigger <Plus className="h-4 w-4" />
    </Button>
  );
}

import { Button } from '@/components/ui/v3/button';
import { Plus } from 'lucide-react';

export default function CreateCronTriggerForm() {
  return (
    <Button variant="ghost" size="icon" aria-label="Add cron trigger">
      <Plus className="h-5 w-5 text-primary dark:text-foreground" />
    </Button>
  );
}

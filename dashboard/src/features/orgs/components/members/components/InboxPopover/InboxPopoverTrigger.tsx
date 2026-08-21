import { Bell } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { useHasUnreadNotification } from '@/features/orgs/components/members/hooks/useHasUnreadNotification';
import { cn } from '@/lib/utils';

export type InboxPopoverTriggerProps = ButtonProps;

export default function InboxPopoverTrigger({
  className,
  ...props
}: InboxPopoverTriggerProps) {
  const hasUnread = useHasUnreadNotification();
  return (
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        className={cn('relative flex h-8 w-8 items-center p-0', className)}
        aria-label="Inbox"
        {...props}
      >
        <Bell className="h-4.5 w-4.5" />
        {hasUnread && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-paper" />
        )}
      </Button>
    </PopoverTrigger>
  );
}

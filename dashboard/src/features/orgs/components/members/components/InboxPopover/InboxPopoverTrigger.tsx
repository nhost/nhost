import { Bell } from 'lucide-react';
import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';

export interface InboxPopoverTriggerProps extends ButtonProps {
  hasUnread?: boolean;
}

const InboxPopoverTrigger = forwardRef<
  HTMLButtonElement,
  InboxPopoverTriggerProps
>(({ className, hasUnread = false, ...props }, ref) => (
  <PopoverTrigger asChild>
    <Button
      ref={ref}
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
));
InboxPopoverTrigger.displayName = 'InboxPopoverTrigger';

export default InboxPopoverTrigger;

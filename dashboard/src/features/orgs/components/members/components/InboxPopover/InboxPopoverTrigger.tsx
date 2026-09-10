import { Bell } from 'lucide-react';
import { IconButton, type IconButtonProps } from '@/components/ui/v3/icon-button';
import { PopoverTrigger } from '@/components/ui/v3/popover';
import { cn } from '@/lib/utils';

export interface InboxPopoverTriggerProps extends Omit<IconButtonProps, 'icon'> {
  hasUnread?: boolean;
}

export default function InboxPopoverTrigger({
  className,
  hasUnread = false,
  ...props
}: InboxPopoverTriggerProps) {
  return (
    <PopoverTrigger asChild>
      <IconButton
        icon={Bell}
        className={cn('relative', className)}
        aria-label="Inbox"
        {...props}
      >
        {hasUnread && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-paper" />
        )}
      </IconButton>
    </PopoverTrigger>
  );
}

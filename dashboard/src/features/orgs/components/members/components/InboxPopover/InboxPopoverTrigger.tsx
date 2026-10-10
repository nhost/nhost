import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  INBOX_POPOVER_ID,
  inboxAnchorRef,
  setInboxOpen,
  useInboxOpen,
} from '@/features/orgs/components/members/components/InboxPopover/inboxStore';
import { cn } from '@/lib/utils';

interface InboxPopoverTriggerProps {
  hasUnread?: boolean;
  className?: string;
}

// Not a `PopoverTrigger`: the popover is rendered once by `Header` and is
// opened from the account menu on mobile, so this button carries the trigger
// semantics itself.
export default function InboxPopoverTrigger({
  hasUnread = false,
  className,
}: InboxPopoverTriggerProps) {
  const open = useInboxOpen();

  return (
    <Button
      ref={inboxAnchorRef}
      variant="subtle"
      className={cn('relative', className)}
      aria-label="Inbox"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? INBOX_POPOVER_ID : undefined}
      onClick={() => setInboxOpen(!open)}
    >
      <Bell />
      {hasUnread && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </Button>
  );
}

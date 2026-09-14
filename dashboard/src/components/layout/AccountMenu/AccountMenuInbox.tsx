import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import { PopoverClose } from '@/components/ui/v3/popover';

export interface AccountMenuInboxProps {
  hasUnread: boolean;
  onClick: VoidFunction;
}

export default function AccountMenuInbox({
  hasUnread,
  onClick,
}: AccountMenuInboxProps) {
  return (
    <PopoverClose asChild>
      <Button
        variant="ghost"
        className="h-9 w-full justify-start gap-2 px-2"
        onClick={onClick}
      >
        <BellIcon className="h-4 w-4" />
        <span className="flex-1 text-left">Inbox</span>
        {hasUnread && (
          <>
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary"
            />
            <span className="sr-only">, unread</span>
          </>
        )}
      </Button>
    </PopoverClose>
  );
}

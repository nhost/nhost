import { EllipsisVertical } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';

export interface AnnouncementMenuProps {
  isUnread: boolean;
  onSetRead: () => void;
  onSetUnread: () => void;
}

export default function AnnouncementMenu({
  isUnread,
  onSetRead,
  onSetUnread,
}: AnnouncementMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label="Open announcement actions"
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={-5}>
        <DropdownMenuItem
          disabled={!isUnread}
          onClick={(e) => {
            e.stopPropagation();
            onSetRead();
          }}
        >
          Mark as read
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isUnread} onClick={onSetUnread}>
          Mark as unread
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

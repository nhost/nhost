import { EllipsisVertical } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';

interface AnnouncementMenuProps {
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
          variant="subtle"
          size="icon-sm"
          className="flex-shrink-0"
          aria-label="Open announcement actions"
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={-5}>
        {isUnread ? (
          <DropdownMenuItem onClick={onSetRead}>Mark as read</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onSetUnread}>
            Mark as unread
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

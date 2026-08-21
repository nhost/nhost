import { X } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverClose,
  PopoverContent,
} from '@/components/ui/v3/popover';
import AnnouncementsSection from './components/AnnouncementsSection';
import NotificationsSection from './components/NotificationsSection';
import InboxPopoverTrigger from './InboxPopoverTrigger';

export interface InboxPopoverProps {
  className?: string;
}

export default function InboxPopover({ className }: InboxPopoverProps) {
  return (
    <Popover>
      <InboxPopoverTrigger className={className} />

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-2rem),32rem)] overflow-hidden p-0"
      >
        <div className="flex h-14 items-center justify-between border-b px-5">
          <h2 className="font-semibold text-lg">Inbox</h2>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Close inbox"
            >
              <X className="h-4 w-4" />
            </Button>
          </PopoverClose>
        </div>

        <div className="max-h-[min(calc(100vh-8rem),32rem)] overflow-y-auto">
          <NotificationsSection />

          <AnnouncementsSection />
        </div>
      </PopoverContent>
    </Popover>
  );
}

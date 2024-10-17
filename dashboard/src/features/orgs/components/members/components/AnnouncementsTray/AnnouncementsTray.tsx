import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { Announcements } from '@/features/projects/common/components/Announcements';
import { Megaphone } from 'lucide-react';

export default function AnnouncementsTray() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="relative h-fit px-3 py-1">
          <Megaphone className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="h-full w-full bg-background p-0 text-foreground sm:max-w-[310px]">
        <SheetHeader>
          <SheetTitle className="sr-only">Announcements</SheetTitle>
          <SheetDescription className="sr-only">
            Latest news and announcements.
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col px-8 pt-3">
          <Announcements />
        </div>
      </SheetContent>
    </Sheet>
  );
}

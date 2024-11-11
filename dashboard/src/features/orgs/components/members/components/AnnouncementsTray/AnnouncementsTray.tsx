import { Badge } from '@/components/ui/v3/badge';
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
import { useGetAnnouncementsQuery } from '@/utils/__generated__/graphql';
import { Megaphone } from 'lucide-react';

export default function AnnouncementsTray() {
  const { data } = useGetAnnouncementsQuery();
  const announcements = data?.announcements ?? [];
  const unreadAnnouncementsCount = announcements.filter(
    (ann) => ann.read.length === 0,
  ).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="relative flex h-8 items-center gap-2 px-2"
        >
          <Megaphone className="h-4.5 w-4.5" />
          {unreadAnnouncementsCount > 0 && (
            <Badge variant="destructive">{unreadAnnouncementsCount}</Badge>
          )}
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
          <Announcements announcements={announcements} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import {
  useDeleteAnnouncementReadMutation,
  useGetAnnouncementsQuery,
  useInsertAnnouncementReadMutation,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { formatDistance } from 'date-fns';
import { EllipsisVertical, Megaphone } from 'lucide-react';
import Link from 'next/link';

export default function AnnouncementsTray() {
  const { isAuthenticated } = useAuthenticationStatus();

  const {
    data,
    loading,
    refetch: refetchAnnouncements,
  } = useGetAnnouncementsQuery({
    skip: !isAuthenticated,
  });

  const [insertAnnouncementRead] = useInsertAnnouncementReadMutation();
  const [deleteAnnouncementRead] = useDeleteAnnouncementReadMutation();

  const announcements = data?.announcements ?? [];
  const unreadAnnouncementsCount = announcements.filter(
    (ann) => ann.read.length === 0,
  ).length;

  const handleSetUnread = async (announcementReadId: string) => {
    await deleteAnnouncementRead({
      variables: {
        id: announcementReadId,
      },
    });

    await refetchAnnouncements();
  };

  const handleSetRead = async (announcementID: string) => {
    await insertAnnouncementRead({
      variables: { announcementID },
    });

    await refetchAnnouncements();
  };

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
        <div className="flex h-full w-full flex-col">
          <div className="flex h-12 items-center border-b px-2">
            <h3 className="font-medium">
              Latest Announcements{' '}
              {unreadAnnouncementsCount > 0 && `(${unreadAnnouncementsCount})`}
            </h3>
          </div>

          <div className="flex h-full flex-col gap-2 overflow-auto p-2">
            {!loading && announcements.length === 0 && (
              <span className="text-muted-foreground">
                No new announcements
              </span>
            )}
            {announcements.map((announcement) => (
              <Button
                key={announcement.id}
                variant="ghost"
                asChild
                className="h-fit w-full items-start gap-2 rounded-md border p-2"
              >
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href={announcement.href}
                  shallow
                  onClick={() => {
                    if (announcement.read.length === 0) {
                      handleSetRead(announcement.id);
                    }
                  }}
                >
                  {announcement.read.length === 0 ? (
                    <span className="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  ) : (
                    <span className="mt-[5px] h-2 w-2 flex-shrink-0" />
                  )}
                  <div className="flex flex-row">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistance(
                          new Date(announcement.createdAt),
                          new Date(),
                          {
                            addSuffix: true,
                          },
                        )}
                      </span>
                      <p className="whitespace-normal">
                        {announcement.content}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 px-3"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <div className="absolute">
                            <EllipsisVertical className="h-4 w-4" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side="bottom"
                        align="end"
                        sideOffset={-5}
                      >
                        <DropdownMenuItem
                          disabled={announcement.read.length > 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetRead(announcement.id);
                          }}
                        >
                          Mark as read
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={announcement.read.length === 0}
                          onClick={() =>
                            handleSetUnread(announcement.read.at(0).id)
                          }
                        >
                          Mark as unread
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
